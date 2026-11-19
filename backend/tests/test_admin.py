import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from main import app
from db.database import Base, get_db
from models.user import User, RoleEnum
from models.complaint import ComplaintCategory, ComplaintPriority, ComplaintStatus, Complaint
from core.security import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_admin.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
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
    
    # Create test users
    admin = User(email="admin@test.com", full_name="Admin", password_hash=get_password_hash("password"), role=RoleEnum.admin, is_active=True)
    staff = User(email="staff@test.com", full_name="Staff", password_hash=get_password_hash("password"), role=RoleEnum.staff, is_active=True)
    inactive_staff = User(email="inactive_staff@test.com", full_name="Inactive Staff", password_hash=get_password_hash("password"), role=RoleEnum.staff, is_active=False)
    student = User(email="student@test.com", full_name="Student", password_hash=get_password_hash("password"), role=RoleEnum.student, is_active=True)
    
    db.add_all([admin, staff, inactive_staff, student])
    db.commit()
    
    db.refresh(admin)
    db.refresh(staff)
    db.refresh(inactive_staff)
    db.refresh(student)
    
    # Create test complaint
    complaint1 = Complaint(
        student_id=student.id,
        title="Test Complaint",
        description="Testing.",
        category=ComplaintCategory.other,
        location="Campus",
        priority=ComplaintPriority.low,
        status=ComplaintStatus.submitted
    )
    db.add(complaint1)
    db.commit()
    db.refresh(complaint1)
    
    yield
    
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()
    db.close()

def get_token_for(email: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "password"})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]

def test_admin_list_complaints():
    token = get_token_for("admin@test.com")
    response = client.get("/api/v1/admin/complaints", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["title"] == "Test Complaint"

def test_admin_complaint_details():
    token = get_token_for("admin@test.com")
    # Get ID first
    response = client.get("/api/v1/admin/complaints", headers={"Authorization": f"Bearer {token}"})
    c_id = response.json()[0]["id"]
    
    response2 = client.get(f"/api/v1/admin/complaints/{c_id}", headers={"Authorization": f"Bearer {token}"})
    assert response2.status_code == 200
    assert response2.json()["id"] == c_id

def test_student_cannot_access_admin_list():
    token = get_token_for("student@test.com")
    response = client.get("/api/v1/admin/complaints", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_staff_cannot_access_admin_list():
    token = get_token_for("staff@test.com")
    response = client.get("/api/v1/admin/complaints", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_admin_list_active_staff():
    token = get_token_for("admin@test.com")
    response = client.get("/api/v1/admin/staff", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["email"] == "staff@test.com"
    assert "password_hash" not in data[0]

def test_admin_assign_complaint():
    token = get_token_for("admin@test.com")
    staff_res = client.get("/api/v1/admin/staff", headers={"Authorization": f"Bearer {token}"})
    staff_id = staff_res.json()[0]["id"]
    
    comp_res = client.get("/api/v1/admin/complaints", headers={"Authorization": f"Bearer {token}"})
    c_id = comp_res.json()[0]["id"]
    
    assign_res = client.patch(
        f"/api/v1/admin/complaints/{c_id}/assign",
        headers={"Authorization": f"Bearer {token}"},
        json={"staff_id": staff_id}
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["assigned_staff_id"] == staff_id
    assert assign_res.json()["status"] == "assigned"

def test_admin_cannot_assign_student():
    token = get_token_for("admin@test.com")
    comp_res = client.get("/api/v1/admin/complaints", headers={"Authorization": f"Bearer {token}"})
    c_id = comp_res.json()[0]["id"]
    
    # Needs to get student id. We'll just login to get it.
    student_res = client.post("/api/v1/auth/login", json={"email": "student@test.com", "password": "password"})
    student_id = student_res.json()["user_id"]
    
    assign_res = client.patch(
        f"/api/v1/admin/complaints/{c_id}/assign",
        headers={"Authorization": f"Bearer {token}"},
        json={"staff_id": student_id}
    )
    assert assign_res.status_code == 400

def test_admin_cannot_assign_inactive_staff():
    token = get_token_for("admin@test.com")
    comp_res = client.get("/api/v1/admin/complaints", headers={"Authorization": f"Bearer {token}"})
    c_id = comp_res.json()[0]["id"]
    
    db = TestingSessionLocal()
    inactive = db.query(User).filter(User.email == "inactive_staff@test.com").first()
    inactive_id = inactive.id
    db.close()
    
    assign_res = client.patch(
        f"/api/v1/admin/complaints/{c_id}/assign",
        headers={"Authorization": f"Bearer {token}"},
        json={"staff_id": inactive_id}
    )
    assert assign_res.status_code == 400

def test_unauthenticated_cannot_access():
    response = client.get("/api/v1/admin/complaints")
    assert response.status_code == 401

def test_admin_analytics_success():
    token = get_token_for("admin@test.com")
    response = client.get("/api/v1/admin/analytics", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["total_complaints"] >= 1
    assert "assigned" in data["status_distribution"]
    assert "other" in data["category_distribution"]
    assert "staff_workload" in data
    # Staff workload should be a list
    assert isinstance(data["staff_workload"], list)

def test_student_cannot_access_analytics():
    token = get_token_for("student@test.com")
    response = client.get("/api/v1/admin/analytics", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_staff_cannot_access_analytics():
    token = get_token_for("staff@test.com")
    response = client.get("/api/v1/admin/analytics", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_admin_complaints_limit():
    token = get_token_for("admin@test.com")
    response = client.get("/api/v1/admin/complaints?limit=1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

def test_admin_cannot_duplicate_assignment():
    token = get_token_for("admin@test.com")
    # Get staff ID
    staff_res = client.get("/api/v1/admin/staff", headers={"Authorization": f"Bearer {token}"})
    staff_id = staff_res.json()[0]["id"]
    
    # Get complaint ID
    comp_res = client.get("/api/v1/admin/complaints", headers={"Authorization": f"Bearer {token}"})
    c_id = comp_res.json()[0]["id"]
    
    # Assign once
    client.patch(
        f"/api/v1/admin/complaints/{c_id}/assign",
        headers={"Authorization": f"Bearer {token}"},
        json={"staff_id": staff_id}
    )
    
    # Get history before
    history_before = client.get(f"/api/v1/admin/complaints/{c_id}/history", headers={"Authorization": f"Bearer {token}"}).json()
    count_before = len(history_before)
    
    # Assign again (duplicate)
    dup_res = client.patch(
        f"/api/v1/admin/complaints/{c_id}/assign",
        headers={"Authorization": f"Bearer {token}"},
        json={"staff_id": staff_id}
    )
    assert dup_res.status_code == 200 # Returns successfully
    
    # Verify no new history was created
    history_after = client.get(f"/api/v1/admin/complaints/{c_id}/history", headers={"Authorization": f"Bearer {token}"}).json()
    assert len(history_after) == count_before

def test_admin_cannot_assign_resolved_complaint():
    # Setup: Resolve the complaint first
    token = get_token_for("staff@test.com")
    # Need complaint ID assigned to staff
    comp_res = client.get("/api/v1/staff/complaints", headers={"Authorization": f"Bearer {token}"})
    c_id = comp_res.json()[0]["id"]
    
    client.patch(
        f"/api/v1/staff/complaints/{c_id}/status",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "in_progress"}
    )
    
    res = client.patch(
        f"/api/v1/staff/complaints/{c_id}/status",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "resolved", "resolution_note": "Done"}
    )
    assert res.status_code == 200
    
    # Now admin tries to reassign
    admin_token = get_token_for("admin@test.com")
    staff_res = client.get("/api/v1/admin/staff", headers={"Authorization": f"Bearer {admin_token}"})
    staff_id = staff_res.json()[0]["id"]
    
    assign_res = client.patch(
        f"/api/v1/admin/complaints/{c_id}/assign",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"staff_id": staff_id}
    )
    assert assign_res.status_code == 400
    assert "resolved or closed" in assign_res.json()["detail"]
