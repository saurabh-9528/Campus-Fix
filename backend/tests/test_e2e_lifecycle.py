import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.security import create_access_token, get_password_hash
from db.database import Base, get_db
from main import app
from models.user import RoleEnum, User

DB_PATH = "./test_e2e_lifecycle.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
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
        email="e2e_admin@test.com",
        full_name="E2E Admin",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.admin,
        is_active=True,
        account_status="active",
    )
    staff = User(
        email="e2e_staff@test.com",
        full_name="E2E Staff",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.staff,
        employee_id="EMP_E2E_1",
        department="Electrical",
        is_active=True,
        account_status="active",
        must_change_password=False,
    )
    student = User(
        email="e2e_student@test.com",
        full_name="E2E Student",
        password_hash=get_password_hash("password123"),
        role=RoleEnum.student,
        student_id="STU_E2E_1",
        is_active=True,
        account_status="active",
    )
    db.add_all([admin, staff, student])
    db.commit()
    for user in (admin, staff, student):
        db.refresh(user)

    yield {"admin": admin, "staff": staff, "student": student}

    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    app.dependency_overrides.clear()
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)


def _auth_header(user_id: int) -> dict[str, str]:
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def _run_invalid_ticket_round_trip(
    student_headers: dict[str, str],
    admin_headers: dict[str, str],
    staff_headers: dict[str, str],
    staff_id: int,
    title: str,
    description: str,
    location: str,
    verification_note: str,
    expected_initial_invalid_count: int,
) -> int:
    # 1. Student submits complaint with pinned coordinates in location
    create_res = client.post(
        "/api/v1/complaints/student/",
        headers=student_headers,
        json={
            "title": f"  {title}\x00  ",
            "description": f"  {description}\x07  ",
            "category": "electrical",
            "location": f"  {location}\x00  ",
            "priority": "high",
        },
    )
    assert create_res.status_code == 201
    created = create_res.json()
    complaint_id = created["id"]
    assert created["title"] == title
    assert created["description"] == description
    assert created["location"] == location
    assert created["status"] == "submitted"

    # 2. Admin inspects complaints, verifies initial invalid_complaint_count, and assigns to staff
    admin_list_res = client.get("/api/v1/admin/complaints", headers=admin_headers)
    assert admin_list_res.status_code == 200
    admin_ticket = next(c for c in admin_list_res.json() if c["id"] == complaint_id)
    assert admin_ticket["invalid_complaint_count"] == expected_initial_invalid_count

    assign_res = client.patch(
        f"/api/v1/admin/complaints/{complaint_id}/assign",
        headers=admin_headers,
        json={"staff_id": staff_id},
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["status"] == "assigned"
    assert assign_res.json()["assigned_staff_id"] == staff_id

    # 3. Staff views assigned list, starts work, and marks invalid with required note
    staff_list_res = client.get("/api/v1/staff/complaints", headers=staff_headers)
    assert staff_list_res.status_code == 200
    assert any(c["id"] == complaint_id for c in staff_list_res.json())

    start_res = client.patch(
        f"/api/v1/staff/complaints/{complaint_id}/status",
        headers=staff_headers,
        json={"status": "in_progress"},
    )
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "in_progress"

    empty_note_res = client.patch(
        f"/api/v1/staff/complaints/{complaint_id}/status",
        headers=staff_headers,
        json={"status": "invalid", "resolution_note": "   "},
    )
    assert empty_note_res.status_code in (400, 422)

    invalid_res = client.patch(
        f"/api/v1/staff/complaints/{complaint_id}/status",
        headers=staff_headers,
        json={"status": "invalid", "resolution_note": verification_note},
    )
    assert invalid_res.status_code == 200
    assert invalid_res.json()["status"] == "invalid"
    assert invalid_res.json()["resolution_note"] == verification_note

    # 4. Student fetches My Complaints and sees invalid status + exact resolution_note
    student_list_res = client.get("/api/v1/complaints/student/", headers=student_headers)
    assert student_list_res.status_code == 200
    student_ticket = next(c for c in student_list_res.json() if c["id"] == complaint_id)
    assert student_ticket["status"] == "invalid"
    assert student_ticket["resolution_note"] == verification_note

    return complaint_id


def test_cross_role_e2e_invalid_complaint_lifecycle(setup_database):
    admin = setup_database["admin"]
    staff = setup_database["staff"]
    student = setup_database["student"]

    admin_headers = _auth_header(admin.id)
    staff_headers = _auth_header(staff.id)
    student_headers = _auth_header(student.id)

    note_1 = "Inspected Hostel Block Room 204; fixture is working normally."
    comp_1_id = _run_invalid_ticket_round_trip(
        student_headers=student_headers,
        admin_headers=admin_headers,
        staff_headers=staff_headers,
        staff_id=staff.id,
        title="Broken ceiling fan in Room 204",
        description="Fan not spinning at all.",
        location="Hostel Block (28.5450, 77.1926)",
        verification_note=note_1,
        expected_initial_invalid_count=0,
    )

    note_2 = "Checked Library 2nd floor; no outage or missing socket found."
    comp_2_id = _run_invalid_ticket_round_trip(
        student_headers=student_headers,
        admin_headers=admin_headers,
        staff_headers=staff_headers,
        staff_id=staff.id,
        title="Power socket missing in Library",
        description="No power in study desk row 3.",
        location="Library (28.5461, 77.1932)",
        verification_note=note_2,
        expected_initial_invalid_count=1,
    )

    # 5. Confirm Admin endpoints report invalid_complaint_count == 2
    admin_complaints_res = client.get("/api/v1/admin/complaints", headers=admin_headers)
    assert admin_complaints_res.status_code == 200
    complaints_by_id = {c["id"]: c for c in admin_complaints_res.json()}
    assert complaints_by_id[comp_1_id]["invalid_complaint_count"] == 2
    assert complaints_by_id[comp_2_id]["invalid_complaint_count"] == 2

    admin_students_res = client.get("/api/v1/admin/students", headers=admin_headers)
    assert admin_students_res.status_code == 200
    student_row = next(s for s in admin_students_res.json() if s["id"] == student.id)
    assert student_row["invalid_complaint_count"] == 2
