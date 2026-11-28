import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.database import Base
from models.user import User, RoleEnum
from core.security import get_password_hash, verify_password
from admin_bootstrap import bootstrap_admin

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_admin_bootstrap.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_bootstrap_creates_active_admin(monkeypatch, capsys):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@campusfix.edu")
    monkeypatch.setenv("ADMIN_PASSWORD", "StrongPass!123")
    monkeypatch.setenv("ADMIN_FULL_NAME", "System Admin")

    db = TestingSessionLocal()
    try:
        code = bootstrap_admin(db=db)
        assert code == 0

        user = db.query(User).filter(User.email == "admin@campusfix.edu").first()
        assert user is not None
        assert user.role == RoleEnum.admin
        assert user.is_active is True
        assert user.full_name == "System Admin"
        assert verify_password("StrongPass!123", user.password_hash)

        captured = capsys.readouterr()
        assert "StrongPass!123" not in captured.out
        assert "StrongPass!123" not in captured.err
        assert user.password_hash not in captured.out
    finally:
        db.close()


def test_bootstrap_existing_active_admin_no_changes(monkeypatch, capsys):
    db = TestingSessionLocal()
    try:
        original_hash = get_password_hash("ExistingPass!123")
        admin = User(
            email="admin@campusfix.edu",
            full_name="Original Admin",
            password_hash=original_hash,
            role=RoleEnum.admin,
            is_active=True,
        )
        db.add(admin)
        db.commit()

        monkeypatch.setenv("ADMIN_EMAIL", "admin@campusfix.edu")
        monkeypatch.setenv("ADMIN_PASSWORD", "NewAttemptedPass!456")

        code = bootstrap_admin(db=db)
        assert code == 0

        db.refresh(admin)
        assert admin.password_hash == original_hash
        assert admin.full_name == "Original Admin"
        assert admin.is_active is True

        captured = capsys.readouterr()
        assert "already exists" in captured.out.lower()
        assert "NewAttemptedPass!456" not in captured.out
    finally:
        db.close()


def test_bootstrap_existing_inactive_admin_refuses_reactivation(monkeypatch, capsys):
    db = TestingSessionLocal()
    try:
        original_hash = get_password_hash("InactiveAdminPass!1")
        admin = User(
            email="admin@campusfix.edu",
            full_name="Inactive Admin",
            password_hash=original_hash,
            role=RoleEnum.admin,
            is_active=False,
        )
        db.add(admin)
        db.commit()

        monkeypatch.setenv("ADMIN_EMAIL", "admin@campusfix.edu")
        monkeypatch.setenv("ADMIN_PASSWORD", "NewAttemptedPass!456")

        code = bootstrap_admin(db=db)
        assert code == 1

        db.refresh(admin)
        assert admin.is_active is False
        assert admin.password_hash == original_hash

        captured = capsys.readouterr()
        assert "inactive" in captured.err.lower()
    finally:
        db.close()


@pytest.mark.parametrize("existing_role", [RoleEnum.student, RoleEnum.staff])
def test_bootstrap_existing_non_admin_conflict_no_modification(monkeypatch, capsys, existing_role):
    db = TestingSessionLocal()
    try:
        original_hash = get_password_hash("UserPass!123")
        user = User(
            email="admin@campusfix.edu",
            full_name="Existing User",
            password_hash=original_hash,
            role=existing_role,
            is_active=True,
        )
        db.add(user)
        db.commit()

        monkeypatch.setenv("ADMIN_EMAIL", "admin@campusfix.edu")
        monkeypatch.setenv("ADMIN_PASSWORD", "NewAttemptedPass!456")

        code = bootstrap_admin(db=db)
        assert code == 1

        db.refresh(user)
        assert user.role == existing_role
        assert user.password_hash == original_hash

        captured = capsys.readouterr()
        assert existing_role.value in captured.err.lower()
    finally:
        db.close()


def test_bootstrap_missing_env_vars_fails_safely(monkeypatch, capsys):
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

    db = TestingSessionLocal()
    try:
        code = bootstrap_admin(db=db)
        assert code == 1
        assert db.query(User).count() == 0

        captured = capsys.readouterr()
        assert "ADMIN_EMAIL" in captured.err
    finally:
        db.close()
