import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.security import create_access_token, get_password_hash
from db.database import Base, get_db
from main import app
from models.complaint import Complaint, ComplaintCategory, ComplaintPriority, ComplaintStatus
from models.user import RoleEnum, User

engine = create_engine("sqlite:///./test_security.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    admin = User(
        email="sec_admin@test.com",
        full_name="Sec Admin",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.admin,
        is_active=True,
        account_status="active",
    )
    staff_a = User(
        email="sec_staff_a@test.com",
        full_name="Staff A",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.staff,
        employee_id="EMP_SA",
        department="Electrical",
        is_active=True,
        account_status="active",
        must_change_password=False,
    )
    staff_b = User(
        email="sec_staff_b@test.com",
        full_name="Staff B",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.staff,
        employee_id="EMP_SB",
        department="Electrical",
        is_active=True,
        account_status="active",
        must_change_password=False,
    )
    student_a = User(
        email="sec_student_a@test.com",
        full_name="Student A",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.student,
        student_id="STU_SA",
        is_active=True,
        account_status="active",
    )
    student_b = User(
        email="sec_student_b@test.com",
        full_name="Student B",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.student,
        student_id="STU_SB",
        is_active=True,
        account_status="active",
    )
    inactive_student = User(
        email="sec_inactive@test.com",
        full_name="Inactive Student",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.student,
        student_id="STU_INACTIVE",
        is_active=False,
        account_status="inactive",
    )
    db.add_all([admin, staff_a, staff_b, student_a, student_b, inactive_student])
    db.commit()
    for user in [admin, staff_a, staff_b, student_a, student_b, inactive_student]:
        db.refresh(user)

    comp_a = Complaint(
        student_id=student_a.id,
        title="Student A Issue",
        description="Broken light",
        category=ComplaintCategory.electrical,
        location="Block A",
        priority=ComplaintPriority.medium,
        status=ComplaintStatus.assigned,
        assigned_staff_id=staff_a.id,
    )
    comp_b = Complaint(
        student_id=student_b.id,
        title="Student B Issue",
        description="Broken pipe",
        category=ComplaintCategory.water,
        location="Block B",
        priority=ComplaintPriority.high,
        status=ComplaintStatus.assigned,
        assigned_staff_id=staff_b.id,
    )
    db.add_all([comp_a, comp_b])
    db.commit()
    db.refresh(comp_a)
    db.refresh(comp_b)

    yield {
        "admin": admin,
        "staff_a": staff_a,
        "staff_b": staff_b,
        "student_a": student_a,
        "student_b": student_b,
        "inactive_student": inactive_student,
        "comp_a": comp_a,
        "comp_b": comp_b,
    }

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


def _auth_header(user_id: int) -> dict[str, str]:
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def test_security_headers_present():
    res = client.get("/")
    assert res.status_code == 200
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_role_based_access_control(setup_database):
    student_headers = _auth_header(setup_database["student_a"].id)
    staff_headers = _auth_header(setup_database["staff_a"].id)
    admin_headers = _auth_header(setup_database["admin"].id)

    assert client.get("/api/v1/admin/complaints", headers=student_headers).status_code == 403
    assert client.get("/api/v1/staff/complaints", headers=student_headers).status_code == 403
    assert client.get("/api/v1/admin/students", headers=staff_headers).status_code == 403
    assert client.get("/api/v1/complaints/student/", headers=admin_headers).status_code == 403


def test_idor_student_isolation(setup_database):
    student_a_headers = _auth_header(setup_database["student_a"].id)
    comp_b_id = setup_database["comp_b"].id

    res = client.get(f"/api/v1/complaints/student/{comp_b_id}", headers=student_a_headers)
    assert res.status_code == 404


def test_idor_staff_isolation_including_invalid_marking(setup_database):
    staff_a_headers = _auth_header(setup_database["staff_a"].id)
    comp_b_id = setup_database["comp_b"].id

    assert client.get(f"/api/v1/staff/complaints/{comp_b_id}", headers=staff_a_headers).status_code == 404
    res = client.patch(
        f"/api/v1/staff/complaints/{comp_b_id}/status",
        json={"status": "invalid", "resolution_note": "Attempted IDOR"},
        headers=staff_a_headers,
    )
    assert res.status_code == 404


def test_deactivated_user_token_rejected(setup_database):
    inactive_headers = _auth_header(setup_database["inactive_student"].id)
    res = client.get("/api/v1/auth/me", headers=inactive_headers)
    assert res.status_code == 403


def test_malformed_token_sub_returns_401():
    bad_token = create_access_token(data={"sub": "not-an-int"})
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {bad_token}"})
    assert res.status_code == 401


def test_upload_rejects_non_image_and_oversized(setup_database):
    student_headers = _auth_header(setup_database["student_a"].id)

    bad_res = client.post(
        "/api/v1/upload/",
        files={"file": ("evil.png", b"not-a-real-image", "image/png")},
        headers=student_headers,
    )
    assert bad_res.status_code == 400

    oversized = b"\x89PNG\r\n\x1a\n" + (b"0" * (5 * 1024 * 1024 + 10))
    big_res = client.post(
        "/api/v1/upload/",
        files={"file": ("big.png", oversized, "image/png")},
        headers=student_headers,
    )
    assert big_res.status_code == 413


def test_control_chars_sanitized_in_complaint(setup_database):
    student_headers = _auth_header(setup_database["student_a"].id)
    res = client.post(
        "/api/v1/complaints/student/",
        json={
            "title": "Bad\x00Title\x07",
            "description": "Line1\nLine2\x00",
            "category": "other",
            "location": "Hall\x0b1",
            "priority": "low",
        },
        headers=student_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "BadTitle"
    assert data["description"] == "Line1\nLine2"
    assert data["location"] == "Hall1"
