import argparse
import getpass
import json
import os
import re
import sys
from typing import Callable, List, Optional, Dict, Any
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.database import SessionLocal
from models.user import User, RoleEnum
from core.security import get_password_hash

EMAIL_REGEX = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$"
)
EMPLOYEE_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{2,32}$")


def validate_email(raw_email: str) -> str:
    if not isinstance(raw_email, str):
        raise ValueError("Email must be a string.")
    if any(ch.isspace() for ch in raw_email):
        raise ValueError("Email must not contain whitespace.")
    if not EMAIL_REGEX.fullmatch(raw_email):
        raise ValueError("Invalid email format or domain.")
    return raw_email.lower()


def validate_entry(item: Dict[str, Any], idx: int = 1) -> Dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError(f"Entry #{idx} must be a JSON object.")

    full_name = str(item.get("full_name") or item.get("name") or "").strip()
    if not full_name:
        raise ValueError(f"Entry #{idx} must have a non-empty 'full_name'.")

    email = validate_email(item.get("email", ""))

    employee_id = str(item.get("employee_id", "")).strip()
    if not employee_id or not EMPLOYEE_ID_REGEX.fullmatch(employee_id):
        raise ValueError(f"Entry #{idx} must have a valid 'employee_id'.")

    department = str(item.get("department", "")).strip()
    if not department:
        raise ValueError(f"Entry #{idx} must have a non-empty 'department'.")

    role_val = str(item.get("role", "Staff")).strip().lower()
    if role_val != "staff":
        raise ValueError(f"Entry #{idx} has unsupported role '{item.get('role')}'; expected 'Staff'.")

    status_val = str(item.get("status", "pending_activation")).strip()
    if status_val != "pending_activation":
        raise ValueError(f"Entry #{idx} must have status 'pending_activation'.")

    must_change = item.get("must_change_password", True)
    if must_change is not True:
        raise ValueError(f"Entry #{idx} must have must_change_password=true.")

    return {
        "employee_id": employee_id,
        "full_name": full_name,
        "email": email,
        "department": department,
        "account_status": "pending_activation",
        "must_change_password": True,
    }


def load_staff_entries(file_path: Optional[str] = None) -> List[Dict[str, Any]]:
    if file_path:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list) or not data:
            raise ValueError("Input file must contain a non-empty JSON list of staff objects.")
        return [validate_entry(item, idx) for idx, item in enumerate(data, start=1)]

    env_email = os.getenv("STAFF_EMAIL", "")
    env_name = os.getenv("STAFF_FULL_NAME", "").strip()
    env_emp_id = os.getenv("STAFF_EMPLOYEE_ID", "").strip()
    env_dept = os.getenv("STAFF_DEPARTMENT", "").strip()
    if env_email and env_name and env_emp_id and env_dept:
        return [
            validate_entry(
                {
                    "employee_id": env_emp_id,
                    "full_name": env_name,
                    "email": env_email,
                    "department": env_dept,
                    "role": "Staff",
                    "status": "pending_activation",
                    "must_change_password": True,
                }
            )
        ]

    raise ValueError(
        "Provide --file <path-to-staff_list.json> or set STAFF_EMAIL, STAFF_FULL_NAME, STAFF_EMPLOYEE_ID, and STAFF_DEPARTMENT."
    )


def bootstrap_staff(
    entries: List[Dict[str, Any]],
    db: Optional[Session] = None,
    confirm: bool = False,
    confirm_fn: Optional[Callable[[str], str]] = None,
    password_fn: Optional[Callable[[str], str]] = None,
) -> int:
    seen_emails = set()
    seen_emp_ids = set()
    normalized_entries: List[Dict[str, Any]] = []
    for idx, entry in enumerate(entries, start=1):
        try:
            normalized = validate_entry(entry, idx)
        except ValueError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1
        if normalized["email"] in seen_emails:
            print(f"Error: Duplicate email in input: {normalized['email']}", file=sys.stderr)
            return 1
        if normalized["employee_id"] in seen_emp_ids:
            print(f"Error: Duplicate employee_id in input: {normalized['employee_id']}", file=sys.stderr)
            return 1
        seen_emails.add(normalized["email"])
        seen_emp_ids.add(normalized["employee_id"])
        normalized_entries.append(normalized)

    owns_session = db is None
    session = db if db is not None else SessionLocal()

    try:
        to_create: List[Dict[str, Any]] = []
        for entry in normalized_entries:
            email = entry["email"]
            employee_id = entry["employee_id"]
            existing_user = (
                session.query(User)
                .filter(func.lower(User.email) == email)
                .first()
            )

            if existing_user:
                if existing_user.role == RoleEnum.staff:
                    if existing_user.account_status in ("active", "pending_activation"):
                        print(f"Staff account already exists ({email}, {existing_user.account_status}); skipping.")
                        continue
                    print(
                        f"Error: Staff account ({email}) exists with status '{existing_user.account_status}'; refusing to modify.",
                        file=sys.stderr,
                    )
                    return 1

                print(
                    f"Error: Account ({email}) already exists with role '{existing_user.role.value}'; refusing to modify.",
                    file=sys.stderr,
                )
                return 1

            existing_emp = (
                session.query(User)
                .filter(User.employee_id == employee_id)
                .first()
            )
            if existing_emp:
                print(
                    f"Error: employee_id '{employee_id}' is already assigned to another account; refusing to modify.",
                    file=sys.stderr,
                )
                return 1

            to_create.append(entry)

        if not to_create:
            print("No new staff accounts to create.")
            return 0

        if not confirm:
            prompt_msg = f"Type 'CREATE STAFF' to confirm creating {len(to_create)} pending staff account(s): "
            response = (confirm_fn or input)(prompt_msg).strip()
            if response != "CREATE STAFF":
                print("Aborted: Confirmation not received; no database changes made.", file=sys.stderr)
                return 1

        prompt_pwd = password_fn or getpass.getpass
        for item in to_create:
            pwd = prompt_pwd(f"Enter temporary password for {item['email']}: ")
            if not pwd or len(pwd) < 8:
                session.rollback()
                print("Error: Password must be at least 8 characters; rolled back batch.", file=sys.stderr)
                return 1

            staff_user = User(
                employee_id=item["employee_id"],
                full_name=item["full_name"],
                email=item["email"],
                department=item["department"],
                password_hash=get_password_hash(pwd),
                role=RoleEnum.staff,
                is_active=False,
                account_status="pending_activation",
                must_change_password=True,
            )
            session.add(staff_user)

        session.commit()
        print(f"Created {len(to_create)} pending staff account(s) successfully.")
        return 0
    except Exception:
        session.rollback()
        print("Error: Failed to bootstrap staff accounts due to a database error.", file=sys.stderr)
        return 1
    finally:
        if owns_session:
            session.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="One-time CampusFix Staff account bootstrap.")
    parser.add_argument("--file", help="Path to JSON file containing staff records")
    parser.add_argument("--confirm", action="store_true", help="Skip interactive confirmation prompt")
    args = parser.parse_args()

    try:
        entries = load_staff_entries(args.file)
    except Exception as exc:
        print(f"Error loading staff entries: {exc}", file=sys.stderr)
        return 1

    return bootstrap_staff(
        entries=entries,
        confirm=args.confirm,
    )


if __name__ == "__main__":
    sys.exit(main())
