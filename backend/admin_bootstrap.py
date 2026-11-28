import os
import sys
from typing import Optional
from sqlalchemy.orm import Session

from db.database import SessionLocal
from models.user import User, RoleEnum
from core.security import get_password_hash


def bootstrap_admin(db: Optional[Session] = None) -> int:
    email = os.getenv("ADMIN_EMAIL", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "")
    full_name = os.getenv("ADMIN_FULL_NAME", "CampusFix Admin").strip() or "CampusFix Admin"

    if not email or not password:
        print("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.", file=sys.stderr)
        return 1

    owns_session = db is None
    session = db if db is not None else SessionLocal()

    try:
        existing_user = session.query(User).filter(User.email == email).first()
        if existing_user:
            if existing_user.role == RoleEnum.admin:
                if existing_user.is_active:
                    print("Active admin account already exists; no changes made.")
                    return 0
                print("Error: Admin account exists but is inactive; refusing to reactivate.", file=sys.stderr)
                return 1

            print(
                f"Error: Account with this email already exists with role '{existing_user.role.value}'; refusing to modify.",
                file=sys.stderr,
            )
            return 1

        admin_user = User(
            full_name=full_name,
            email=email,
            password_hash=get_password_hash(password),
            role=RoleEnum.admin,
            is_active=True,
        )
        session.add(admin_user)
        session.commit()
        print("Admin account created successfully.")
        return 0
    except Exception:
        session.rollback()
        print("Error: Failed to bootstrap admin account due to a database error.", file=sys.stderr)
        return 1
    finally:
        if owns_session:
            session.close()


if __name__ == "__main__":
    sys.exit(bootstrap_admin())
