import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.database import Base
from models.user import User, RoleEnum
from core.security import get_password_hash, verify_password
from staff_bootstrap import bootstrap_staff, load_staff_entries, validate_email

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_staff_bootstrap.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _sample_record(emp_id="EMP001", name="Alice Staff", email="alice@campusfix.edu", dept="Operations"):
    return {
        "employee_id": emp_id,
        "full_name": name,
        "email": email,
        "role": "Staff",
        "department": dept,
        "status": "pending_activation",
        "must_change_password": True,
    }


def test_bootstrap_creates_pending_staff_with_metadata_never_prints_passwords(tmp_path, capsys):
    staff_file = tmp_path / "staff.json"
    staff_file.write_text(
        json.dumps([
            _sample_record("EMP001", "Alice Staff", "alice@campusfix.edu"),
            _sample_record("EMP002", "Bob Staff", "bob@campusfix.edu"),
        ]),
        encoding="utf-8",
    )
    entries = load_staff_entries(str(staff_file))

    passwords = iter(["AliceStrong!123", "BobStrong!456"])
    db = TestingSessionLocal()
    try:
        code = bootstrap_staff(entries, db=db, confirm=True, password_fn=lambda _: next(passwords))
        assert code == 0

        users = db.query(User).order_by(User.email.asc()).all()
        assert len(users) == 2

        assert users[0].employee_id == "EMP001"
        assert users[0].email == "alice@campusfix.edu"
        assert users[0].department == "Operations"
        assert users[0].role == RoleEnum.staff
        assert users[0].is_active is False
        assert users[0].account_status == "pending_activation"
        assert users[0].must_change_password is True
        assert verify_password("AliceStrong!123", users[0].password_hash)

        assert users[1].employee_id == "EMP002"
        assert users[1].email == "bob@campusfix.edu"
        assert users[1].is_active is False
        assert users[1].account_status == "pending_activation"
        assert users[1].must_change_password is True
        assert verify_password("BobStrong!456", users[1].password_hash)

        captured = capsys.readouterr()
        for secret in ("AliceStrong!123", "BobStrong!456", users[0].password_hash, users[1].password_hash):
            assert secret not in captured.out
            assert secret not in captured.err
    finally:
        db.close()


def test_bootstrap_requires_explicit_confirmation(capsys):
    db = TestingSessionLocal()
    try:
        entries = [_sample_record()]
        code = bootstrap_staff(
            entries,
            db=db,
            confirm=False,
            confirm_fn=lambda _: "no",
            password_fn=lambda _: "AliceStrong!123",
        )
        assert code == 1
        assert db.query(User).count() == 0

        captured = capsys.readouterr()
        assert "aborted" in captured.err.lower()

        code_ok = bootstrap_staff(
            entries,
            db=db,
            confirm=False,
            confirm_fn=lambda _: "CREATE STAFF",
            password_fn=lambda _: "AliceStrong!123",
        )
        assert code_ok == 0
        assert db.query(User).count() == 1
    finally:
        db.close()


def test_bootstrap_case_insensitive_existing_staff_idempotent():
    db = TestingSessionLocal()
    try:
        original_hash = get_password_hash("ExistingStaff!123")
        existing = User(
            employee_id="EMP001",
            full_name="Existing Staff",
            email="Alice@CampusFix.edu",
            department="Operations",
            password_hash=original_hash,
            role=RoleEnum.staff,
            is_active=False,
            account_status="pending_activation",
            must_change_password=True,
        )
        db.add(existing)
        db.commit()

        code = bootstrap_staff(
            [_sample_record("EMP001", "Changed Name", "alice@campusfix.edu")],
            db=db,
            confirm=True,
            password_fn=lambda _: "ShouldNotBeCalled!1",
        )
        assert code == 0

        db.refresh(existing)
        assert existing.password_hash == original_hash
        assert existing.full_name == "Existing Staff"
        assert existing.account_status == "pending_activation"
    finally:
        db.close()


def test_bootstrap_refuses_inactive_staff_and_aborts_batch(capsys):
    db = TestingSessionLocal()
    try:
        original_hash = get_password_hash("InactiveStaff!123")
        inactive = User(
            employee_id="EMP099",
            full_name="Inactive Staff",
            email="inactive@campusfix.edu",
            department="Operations",
            password_hash=original_hash,
            role=RoleEnum.staff,
            is_active=False,
            account_status="inactive",
            must_change_password=False,
        )
        db.add(inactive)
        db.commit()

        code = bootstrap_staff(
            [
                _sample_record("EMP001", "New Staff", "new@campusfix.edu"),
                _sample_record("EMP099", "Inactive Staff", "INACTIVE@campusfix.edu"),
            ],
            db=db,
            confirm=True,
            password_fn=lambda _: "NewStaffPass!123",
        )
        assert code == 1

        db.refresh(inactive)
        assert inactive.is_active is False
        assert inactive.account_status == "inactive"
        assert inactive.password_hash == original_hash
        assert db.query(User).filter(User.email == "new@campusfix.edu").first() is None

        captured = capsys.readouterr()
        assert "inactive" in captured.err.lower()
    finally:
        db.close()


@pytest.mark.parametrize("existing_role", [RoleEnum.student, RoleEnum.admin])
def test_bootstrap_refuses_role_conflict_case_insensitive(capsys, existing_role):
    db = TestingSessionLocal()
    try:
        original_hash = get_password_hash("OtherRole!123")
        existing = User(
            full_name="Existing Account",
            email="Conflict@CampusFix.edu",
            password_hash=original_hash,
            role=existing_role,
            is_active=True,
            account_status="active",
        )
        db.add(existing)
        db.commit()

        code = bootstrap_staff(
            [_sample_record("EMP001", "Conflict Staff", "conflict@campusfix.edu")],
            db=db,
            confirm=True,
            password_fn=lambda _: "ConflictPass!123",
        )
        assert code == 1

        db.refresh(existing)
        assert existing.role == existing_role
        assert existing.password_hash == original_hash

        captured = capsys.readouterr()
        assert existing_role.value in captured.err.lower()
    finally:
        db.close()


def test_bootstrap_refuses_duplicate_employee_id_in_db(capsys):
    db = TestingSessionLocal()
    try:
        existing = User(
            employee_id="EMP001",
            full_name="Existing Emp",
            email="other@campusfix.edu",
            department="Operations",
            password_hash=get_password_hash("Existing!123"),
            role=RoleEnum.staff,
            is_active=True,
            account_status="active",
        )
        db.add(existing)
        db.commit()

        code = bootstrap_staff(
            [_sample_record("EMP001", "New Emp", "new@campusfix.edu")],
            db=db,
            confirm=True,
            password_fn=lambda _: "NewPass!123",
        )
        assert code == 1
        assert db.query(User).filter(User.email == "new@campusfix.edu").first() is None

        captured = capsys.readouterr()
        assert "employee_id" in captured.err
    finally:
        db.close()


@pytest.mark.parametrize(
    "bad_email",
    [
        "",
        "not-an-email",
        "alice @campusfix.edu",
        " alice@campusfix.edu",
        "alice@campusfix.edu ",
        "alice@localhost",
        "alice@.campusfix.edu",
        "alice@campusfix..edu",
    ],
)
def test_validate_email_rejects_whitespace_and_invalid_domains(bad_email):
    with pytest.raises(ValueError):
        validate_email(bad_email)


def test_bootstrap_rolls_back_batch_on_short_password():
    db = TestingSessionLocal()
    try:
        passwords = iter(["ValidPass!123", "short"])
        code = bootstrap_staff(
            [
                _sample_record("EMP001", "First Staff", "first@campusfix.edu"),
                _sample_record("EMP002", "Second Staff", "second@campusfix.edu"),
            ],
            db=db,
            confirm=True,
            password_fn=lambda _: next(passwords),
        )
        assert code == 1
        assert db.query(User).count() == 0
    finally:
        db.close()
