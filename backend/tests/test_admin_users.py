import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from db.database import Base, get_db
from models.user import User, RoleEnum
from models.complaint import Complaint, ComplaintCategory, ComplaintPriority, ComplaintStatus
from core.security import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_admin_users.db"
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
        email="existing.student@test.com",
        full_name="Existing Student",
        password_hash=get_password_hash("password"),
        role=RoleEnum.student,
        is_active=True,
        account_status="active",
        must_change_password=False,
        student_id="STU001",
        department="Computer Science",
    )
    staff = User(
        email="existing.staff@test.com",
        full_name="Existing Staff",
        password_hash=get_password_hash("password"),
        role=RoleEnum.staff,
        is_active=True,
        account_status="active",
        must_change_password=False,
        employee_id="EMP001",
        department="Maintenance",
    )
    db.add_all([admin, student, staff])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


def _login(email: str, password: str = "password"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _admin_headers():
    response = _login("admin@test.com")
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _student_payload(**overrides):
    payload = {
        "full_name": "New Student",
        "email": "new.student@test.com",
        "password": "StrongPass!123",
        "student_id": "STU100",
        "department": "Mechanical",
    }
    payload.update(overrides)
    return payload


def _staff_payload(**overrides):
    payload = {
        "full_name": "New Staff",
        "email": "new.staff@test.com",
        "password": "StrongPass!123",
        "employee_id": "EMP100",
        "department": "Electrical",
        "account_status": "pending_activation",
    }
    payload.update(overrides)
    return payload


def _create_complaint(student_email: str, staff_email=None, status_value=ComplaintStatus.assigned):
    db = TestingSessionLocal()
    student = db.query(User).filter(User.email == student_email).first()
    staff = db.query(User).filter(User.email == staff_email).first() if staff_email else None
    complaint = Complaint(
        student_id=student.id,
        title="Test complaint",
        description="Test description",
        category=ComplaintCategory.electrical,
        location="Lab 1",
        priority=ComplaintPriority.medium,
        status=status_value,
        assigned_staff_id=staff.id if staff else None,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    complaint_id = complaint.id
    db.close()
    return complaint_id


def test_admin_create_student_and_login():
    headers = _admin_headers()

    response = client.post(
        "/api/v1/admin/students",
        headers=headers,
        json=_student_payload(email="NEW.STUDENT@test.com"),
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["role"] == "student"
    assert data["email"] == "new.student@test.com"
    assert data["student_id"] == "STU100"
    assert data["department"] == "Mechanical"
    assert data["is_active"] is True
    assert data["account_status"] == "active"
    assert data["total_complaints"] == 0
    assert "password_hash" not in data

    login_res = _login("new.student@test.com", "StrongPass!123")
    assert login_res.status_code == 200
    assert login_res.json()["role"] == "student"


def test_admin_create_student_duplicate_email_and_student_id():
    headers = _admin_headers()
    assert client.post(
        "/api/v1/admin/students", headers=headers, json=_student_payload()
    ).status_code == 201

    duplicate_email = client.post(
        "/api/v1/admin/students",
        headers=headers,
        json=_student_payload(student_id="STU101"),
    )
    assert duplicate_email.status_code == 409
    assert "email already exists" in duplicate_email.json()["detail"]

    duplicate_id = client.post(
        "/api/v1/admin/students",
        headers=headers,
        json=_student_payload(email="another.student@test.com"),
    )
    assert duplicate_id.status_code == 409
    assert "student ID is already in use" in duplicate_id.json()["detail"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"password": "short"},
        {"email": "not-an-email"},
        {"student_id": "bad id!"},
        {"full_name": "   "},
        {"department": "x" * 101},
    ],
)
def test_admin_create_student_validation(overrides):
    headers = _admin_headers()
    response = client.post(
        "/api/v1/admin/students",
        headers=headers,
        json=_student_payload(**overrides),
    )
    assert response.status_code == 422


def test_admin_bulk_create_students_and_atomic_conflict():
    headers = _admin_headers()
    payload = {
        "items": [
            _student_payload(email="bulk1@test.com", student_id="BULK001"),
            _student_payload(
                full_name="Bulk Two",
                email="bulk2@test.com",
                student_id="BULK002",
                department="Civil",
            ),
        ]
    }
    response = client.post("/api/v1/admin/students/bulk", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["created_count"] == 2

    listed = client.get("/api/v1/admin/students?search=bulk", headers=headers)
    assert listed.status_code == 200
    assert {row["email"] for row in listed.json()} == {"bulk1@test.com", "bulk2@test.com"}

    # One conflicting record must reject the whole batch.
    conflict = client.post(
        "/api/v1/admin/students/bulk",
        headers=headers,
        json={
            "items": [
                _student_payload(email="bulk3@test.com", student_id="BULK003"),
                _student_payload(email="bulk1@test.com", student_id="BULK004"),
            ]
        },
    )
    assert conflict.status_code == 409
    assert "already exists" in conflict.json()["detail"]

    still_missing = client.get("/api/v1/admin/students?search=bulk3", headers=headers)
    assert still_missing.status_code == 200
    assert still_missing.json() == []


def test_admin_bulk_create_students_duplicate_within_upload():
    headers = _admin_headers()
    response = client.post(
        "/api/v1/admin/students/bulk",
        headers=headers,
        json={
            "items": [
                _student_payload(email="dupe@test.com", student_id="DUP001"),
                _student_payload(email="dupe@test.com", student_id="DUP002"),
            ]
        },
    )
    assert response.status_code == 409
    assert "Duplicate email" in response.json()["detail"]


def test_admin_list_students_filters_and_complaint_counts():
    headers = _admin_headers()
    _create_complaint("existing.student@test.com")

    db = TestingSessionLocal()
    student_id = db.query(User).filter(User.email == "existing.student@test.com").first().id
    db.close()

    complaints = client.get("/api/v1/admin/complaints", headers=headers)
    assert complaints.status_code == 200
    assert complaints.json()[0]["student_id"] == student_id

    by_search = client.get("/api/v1/admin/students?search=existing", headers=headers)
    assert by_search.status_code == 200
    assert len(by_search.json()) == 1
    assert by_search.json()[0]["total_complaints"] == 1

    by_department = client.get(
        "/api/v1/admin/students?department=Computer%20Science", headers=headers
    )
    assert by_department.status_code == 200
    assert {row["email"] for row in by_department.json()} == {"existing.student@test.com"}

    active_only = client.get("/api/v1/admin/students?status_filter=active", headers=headers)
    assert active_only.status_code == 200
    assert len(active_only.json()) == 1

    inactive_only = client.get("/api/v1/admin/students?status_filter=inactive", headers=headers)
    assert inactive_only.status_code == 200
    assert inactive_only.json() == []


def test_admin_toggle_student_status():
    headers = _admin_headers()
    db = TestingSessionLocal()
    student_id = db.query(User).filter(User.email == "existing.student@test.com").first().id
    staff_id = db.query(User).filter(User.email == "existing.staff@test.com").first().id
    db.close()

    deactivate = client.patch(
        f"/api/v1/admin/students/{student_id}/status",
        headers=headers,
        json={"is_active": False},
    )
    assert deactivate.status_code == 200
    assert deactivate.json()["is_active"] is False
    assert deactivate.json()["account_status"] == "inactive"

    blocked_login = _login("existing.student@test.com")
    assert blocked_login.status_code == 403
    assert "Inactive" in blocked_login.json()["detail"]

    reactivate = client.patch(
        f"/api/v1/admin/students/{student_id}/status",
        headers=headers,
        json={"is_active": True},
    )
    assert reactivate.status_code == 200
    assert reactivate.json()["is_active"] is True
    assert _login("existing.student@test.com").status_code == 200

    wrong_role = client.patch(
        f"/api/v1/admin/students/{staff_id}/status",
        headers=headers,
        json={"is_active": False},
    )
    assert wrong_role.status_code == 400
    assert "not a student" in wrong_role.json()["detail"]

    missing = client.patch(
        "/api/v1/admin/students/999999/status",
        headers=headers,
        json={"is_active": False},
    )
    assert missing.status_code == 404


def test_admin_create_pending_staff_and_activation_flow():
    headers = _admin_headers()
    response = client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(),
    )
    assert response.status_code == 201, response.text
    staff = response.json()
    assert staff["role"] == "staff"
    assert staff["is_active"] is False
    assert staff["account_status"] == "pending_activation"
    assert staff["must_change_password"] is True
    assert staff["active_tasks"] == 0
    assert "password_hash" not in staff

    pending_login = _login("new.staff@test.com", "StrongPass!123")
    assert pending_login.status_code == 403
    assert "pending" in pending_login.json()["detail"].lower()

    activated = client.patch(
        f"/api/v1/admin/staff/{staff['id']}/status",
        headers=headers,
        json={"is_active": True},
    )
    assert activated.status_code == 200
    assert activated.json()["is_active"] is True
    assert activated.json()["account_status"] == "active"
    assert activated.json()["must_change_password"] is True

    login_res = _login("new.staff@test.com", "StrongPass!123")
    assert login_res.status_code == 200
    assert login_res.json()["must_change_password"] is True


def test_admin_create_staff_duplicate_employee_id():
    headers = _admin_headers()
    assert client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(account_status="active"),
    ).status_code == 201

    duplicate = client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(email="other.staff@test.com"),
    )
    assert duplicate.status_code == 409
    assert "employee ID is already in use" in duplicate.json()["detail"]


def test_admin_bulk_create_staff():
    headers = _admin_headers()
    response = client.post(
        "/api/v1/admin/staff/bulk",
        headers=headers,
        json={
            "items": [
                _staff_payload(email="bulk.staff1@test.com", employee_id="BEMP001"),
                _staff_payload(
                    full_name="Bulk Active Staff",
                    email="bulk.staff2@test.com",
                    employee_id="BEMP002",
                    department="Plumbing",
                    account_status="active",
                ),
            ]
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["created_count"] == 2

    listed = client.get(
        "/api/v1/admin/staff?include_pending=true&search=bulk.staff",
        headers=headers,
    )
    assert listed.status_code == 200
    by_email = {row["email"]: row for row in listed.json()}
    assert by_email["bulk.staff1@test.com"]["account_status"] == "pending_activation"
    assert by_email["bulk.staff2@test.com"]["account_status"] == "active"
    assert by_email["bulk.staff2@test.com"]["is_active"] is True

    duplicate_employee = client.post(
        "/api/v1/admin/staff/bulk",
        headers=headers,
        json={
            "items": [
                _staff_payload(email="bulk.staff3@test.com", employee_id="BEMP003"),
                _staff_payload(email="bulk.staff4@test.com", employee_id="BEMP003"),
            ]
        },
    )
    assert duplicate_employee.status_code == 409
    assert "Duplicate employee ID" in duplicate_employee.json()["detail"]


def test_admin_staff_list_filters_task_counts_and_toggle():
    headers = _admin_headers()
    _create_complaint(
        "existing.student@test.com",
        staff_email="existing.staff@test.com",
        status_value=ComplaintStatus.in_progress,
    )
    _create_complaint(
        "existing.student@test.com",
        staff_email="existing.staff@test.com",
        status_value=ComplaintStatus.resolved,
    )

    listed = client.get(
        "/api/v1/admin/staff?include_pending=true&include_inactive=true",
        headers=headers,
    )
    assert listed.status_code == 200
    existing = next(row for row in listed.json() if row["email"] == "existing.staff@test.com")
    assert existing["active_tasks"] == 1

    by_search = client.get("/api/v1/admin/staff?search=existing.staff", headers=headers)
    assert by_search.status_code == 200
    assert {row["email"] for row in by_search.json()} == {"existing.staff@test.com"}

    by_department = client.get(
        "/api/v1/admin/staff?department=Maintenance", headers=headers
    )
    assert by_department.status_code == 200
    assert {row["email"] for row in by_department.json()} == {"existing.staff@test.com"}

    db = TestingSessionLocal()
    staff_id = db.query(User).filter(User.email == "existing.staff@test.com").first().id
    student_id = db.query(User).filter(User.email == "existing.student@test.com").first().id
    db.close()

    deactivated = client.patch(
        f"/api/v1/admin/staff/{staff_id}/status",
        headers=headers,
        json={"is_active": False},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["account_status"] == "inactive"
    assert deactivated.json()["is_active"] is False
    assert deactivated.json()["active_tasks"] == 1

    default_list = client.get("/api/v1/admin/staff", headers=headers)
    assert default_list.status_code == 200
    assert default_list.json() == []

    inactive_list = client.get(
        "/api/v1/admin/staff?include_inactive=true&status_filter=inactive",
        headers=headers,
    )
    assert inactive_list.status_code == 200
    assert {row["email"] for row in inactive_list.json()} == {"existing.staff@test.com"}

    wrong_role = client.patch(
        f"/api/v1/admin/staff/{student_id}/status",
        headers=headers,
        json={"is_active": False},
    )
    assert wrong_role.status_code == 400
    assert "not a staff member" in wrong_role.json()["detail"]


def test_admin_user_management_requires_admin():
    student_token = _login("existing.student@test.com").json()["access_token"]
    staff_token = _login("existing.staff@test.com").json()["access_token"]

    protected_requests = [
        ("get", "/api/v1/admin/students", None),
        ("post", "/api/v1/admin/students", _student_payload()),
        ("post", "/api/v1/admin/students/bulk", {"items": [_student_payload()]}),
        ("get", "/api/v1/admin/staff?include_inactive=true", None),
        ("post", "/api/v1/admin/staff", _staff_payload()),
        ("post", "/api/v1/admin/staff/bulk", {"items": [_staff_payload()]}),
        ("patch", "/api/v1/admin/students/1/status", {"is_active": False}),
        ("patch", "/api/v1/admin/staff/1/status", {"is_active": False}),
    ]

    for method, url, payload in protected_requests:
        kwargs = {"json": payload} if payload is not None else {}
        assert getattr(client, method)(url, **kwargs).status_code == 401

        for token in (student_token, staff_token):
            response = getattr(client, method)(
                url,
                headers={"Authorization": f"Bearer {token}"},
                **kwargs,
            )
            assert response.status_code == 403
