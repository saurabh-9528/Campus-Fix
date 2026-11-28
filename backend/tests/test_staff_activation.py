import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from db.database import Base, get_db
from models.user import User, RoleEnum
from models.complaint import Complaint, ComplaintCategory, ComplaintPriority, ComplaintStatus
from core.security import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_staff_activation.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    admin = User(
        email="admin@test.com",
        full_name="Admin",
        password_hash=get_password_hash("password"),
        role=RoleEnum.admin,
        is_active=True,
        account_status="active",
        must_change_password=False,
    )
    student = User(
        email="student@test.com",
        full_name="Student",
        password_hash=get_password_hash("password"),
        role=RoleEnum.student,
        is_active=True,
        account_status="active",
        must_change_password=False,
    )
    active_staff = User(
        employee_id="EMP100",
        department="Operations",
        email="active.staff@test.com",
        full_name="Active Staff",
        password_hash=get_password_hash("password"),
        role=RoleEnum.staff,
        is_active=True,
        account_status="active",
        must_change_password=False,
    )
    pending_staff = User(
        employee_id="EMP101",
        department="Operations",
        email="pending.staff@test.com",
        full_name="Pending Staff",
        password_hash=get_password_hash("TempPass!123"),
        role=RoleEnum.staff,
        is_active=False,
        account_status="pending_activation",
        must_change_password=True,
    )
    inactive_staff = User(
        employee_id="EMP102",
        department="Operations",
        email="inactive.staff@test.com",
        full_name="Inactive Staff",
        password_hash=get_password_hash("password"),
        role=RoleEnum.staff,
        is_active=False,
        account_status="inactive",
        must_change_password=False,
    )
    db.add_all([admin, student, active_staff, pending_staff, inactive_staff])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


def _login(email: str, password: str):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_pending_staff_cannot_login_and_no_enumeration():
    # Wrong password for pending account must return generic 401 (no enumeration)
    wrong_res = _login("pending.staff@test.com", "WrongPass!999")
    assert wrong_res.status_code == 401
    assert wrong_res.json()["detail"] == "Incorrect email or password"

    # Correct password for pending account returns 403 pending activation
    res = _login("pending.staff@test.com", "TempPass!123")
    assert res.status_code == 403
    assert "pending" in res.json()["detail"].lower()


def test_admin_staff_listing_default_vs_include_pending():
    admin_token = _login("admin@test.com", "password").json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    default_res = client.get("/api/v1/admin/staff", headers=headers)
    assert default_res.status_code == 200
    default_emails = {u["email"] for u in default_res.json()}
    assert default_emails == {"active.staff@test.com"}

    pending_res = client.get("/api/v1/admin/staff?include_pending=true", headers=headers)
    assert pending_res.status_code == 200
    by_email = {u["email"]: u for u in pending_res.json()}
    assert set(by_email.keys()) == {"active.staff@test.com", "pending.staff@test.com"}
    assert by_email["pending.staff@test.com"]["employee_id"] == "EMP101"
    assert by_email["pending.staff@test.com"]["department"] == "Operations"
    assert by_email["pending.staff@test.com"]["account_status"] == "pending_activation"
    assert by_email["pending.staff@test.com"]["must_change_password"] is True
    assert "password_hash" not in by_email["pending.staff@test.com"]


def test_admin_cannot_assign_complaint_to_pending_staff():
    db = TestingSessionLocal()
    student = db.query(User).filter(User.email == "student@test.com").first()
    pending = db.query(User).filter(User.email == "pending.staff@test.com").first()
    c = Complaint(
        student_id=student.id,
        title="Broken AC",
        description="Needs repair",
        category=ComplaintCategory.electrical,
        location="Room 1",
        priority=ComplaintPriority.medium,
        status=ComplaintStatus.submitted,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    c_id, pending_id = c.id, pending.id
    db.close()

    admin_token = _login("admin@test.com", "password").json()["access_token"]
    res = client.patch(
        f"/api/v1/admin/complaints/{c_id}/assign",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"staff_id": pending_id},
    )
    assert res.status_code == 400


def test_staff_activation_rbac_and_guards():
    db = TestingSessionLocal()
    pending_id = db.query(User).filter(User.email == "pending.staff@test.com").first().id
    student_id = db.query(User).filter(User.email == "student@test.com").first().id
    inactive_id = db.query(User).filter(User.email == "inactive.staff@test.com").first().id
    db.close()

    # Unauthenticated / Student / Staff rejected
    assert client.patch(f"/api/v1/admin/staff/{pending_id}/activate").status_code == 401
    student_token = _login("student@test.com", "password").json()["access_token"]
    assert (
        client.patch(
            f"/api/v1/admin/staff/{pending_id}/activate",
            headers={"Authorization": f"Bearer {student_token}"},
        ).status_code
        == 403
    )
    staff_token = _login("active.staff@test.com", "password").json()["access_token"]
    assert (
        client.patch(
            f"/api/v1/admin/staff/{pending_id}/activate",
            headers={"Authorization": f"Bearer {staff_token}"},
        ).status_code
        == 403
    )

    admin_token = _login("admin@test.com", "password").json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    assert client.patch("/api/v1/admin/staff/999999/activate", headers=headers).status_code == 404
    assert client.patch(f"/api/v1/admin/staff/{student_id}/activate", headers=headers).status_code == 400
    assert client.patch(f"/api/v1/admin/staff/{inactive_id}/activate", headers=headers).status_code == 400


def test_full_first_time_staff_activation_and_password_change_flow():
    db = TestingSessionLocal()
    pending_id = db.query(User).filter(User.email == "pending.staff@test.com").first().id
    db.close()

    admin_token = _login("admin@test.com", "password").json()["access_token"]
    act_res = client.patch(
        f"/api/v1/admin/staff/{pending_id}/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert act_res.status_code == 200
    assert act_res.json()["is_active"] is True
    assert act_res.json()["account_status"] == "active"
    # Activation must NOT clear must_change_password
    assert act_res.json()["must_change_password"] is True

    # Staff logs in with temporary password
    login_res = _login("pending.staff@test.com", "TempPass!123")
    assert login_res.status_code == 200
    staff_token = login_res.json()["access_token"]
    assert login_res.json()["must_change_password"] is True
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Blocked from staff endpoints until password is changed
    blocked_res = client.get("/api/v1/staff/complaints", headers=staff_headers)
    assert blocked_res.status_code == 403
    assert "password change required" in blocked_res.json()["detail"].lower()

    # Cannot reuse temporary password
    reuse_res = client.post(
        "/api/v1/auth/change-password",
        headers=staff_headers,
        json={"current_password": "TempPass!123", "new_password": "TempPass!123"},
    )
    assert reuse_res.status_code == 400

    # Change password to a new strong password
    change_res = client.post(
        "/api/v1/auth/change-password",
        headers=staff_headers,
        json={"current_password": "TempPass!123", "new_password": "NewStrongStaff!99"},
    )
    assert change_res.status_code == 200

    # Staff can now access staff endpoints and subsequent login has must_change_password=False
    ok_res = client.get("/api/v1/staff/complaints", headers=staff_headers)
    assert ok_res.status_code == 200

    relogin_res = _login("pending.staff@test.com", "NewStrongStaff!99")
    assert relogin_res.status_code == 200
    assert relogin_res.json()["must_change_password"] is False


def test_existing_admin_student_login_and_registration_disabled():
    admin_res = _login("admin@test.com", "password")
    assert admin_res.status_code == 200
    assert admin_res.json()["role"] == "admin"
    assert admin_res.json()["must_change_password"] is False

    student_res = _login("student@test.com", "password")
    assert student_res.status_code == 200
    assert student_res.json()["role"] == "student"
    assert student_res.json()["must_change_password"] is False

    reg_res = client.post(
        "/api/v1/auth/register",
        json={"full_name": "New Student", "email": "new.student@test.com", "password": "password123"},
    )
    assert reg_res.status_code == 403
