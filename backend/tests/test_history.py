from fastapi.testclient import TestClient
from main import app
from db.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.security import get_password_hash
from models.user import User, RoleEnum
import pytest

# Use in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_history.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
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
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test users
    admin = User(
        email="admin@test.com",
        full_name="Admin User",
        password_hash=get_password_hash("password"),
        role=RoleEnum.admin
    )
    student = User(
        email="student@test.com",
        full_name="Student User",
        password_hash=get_password_hash("password"),
        role=RoleEnum.student
    )
    staff = User(
        email="staff@test.com",
        full_name="Staff User",
        password_hash=get_password_hash("password"),
        role=RoleEnum.staff
    )
    
    db.add(admin)
    db.add(student)
    db.add(staff)
    db.commit()
    db.close()
    
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

def get_token(email: str, password: str = "password"):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    return response.json()["access_token"]

def test_complaint_history_lifecycle():
    student_token = get_token("student@test.com")
    admin_token = get_token("admin@test.com")
    staff_token = get_token("staff@test.com")
    
    student_headers = {"Authorization": f"Bearer {student_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    
    # 1. Student creates a complaint
    complaint_data = {
        "title": "Test Complaint for History",
        "description": "Test description",
        "category": "water",
        "location": "Room 101",
        "priority": "high"
    }
    response = client.post("/api/v1/complaints/student/", json=complaint_data, headers=student_headers)
    assert response.status_code == 201
    complaint_id = response.json()["id"]
    
    # Check student history endpoint
    hist_resp = client.get(f"/api/v1/complaints/student/{complaint_id}/history", headers=student_headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 1
    assert history[0]["action"] == "submitted"
    assert history[0]["new_status"] == "submitted"
    
    # 2. Admin assigns the complaint to staff
    # We need the staff ID
    staff_id = client.get("/api/v1/admin/staff", headers=admin_headers).json()[0]["id"]
    
    assign_resp = client.patch(
        f"/api/v1/admin/complaints/{complaint_id}/assign",
        json={"staff_id": staff_id},
        headers=admin_headers
    )
    assert assign_resp.status_code == 200
    
    # Check admin history endpoint
    hist_resp = client.get(f"/api/v1/admin/complaints/{complaint_id}/history", headers=admin_headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 2
    assert history[1]["action"] == "assigned"
    assert history[1]["new_status"] == "assigned"
    assert history[1]["new_assigned_staff_id"] == staff_id
    
    # 3. Staff moves to in_progress
    inprog_resp = client.patch(
        f"/api/v1/staff/complaints/{complaint_id}/status",
        json={"status": "in_progress"},
        headers=staff_headers
    )
    assert inprog_resp.status_code == 200
    
    # 4. Staff resolves the complaint
    resolve_resp = client.patch(
        f"/api/v1/staff/complaints/{complaint_id}/status",
        json={"status": "resolved", "resolution_note": "Fixed it"},
        headers=staff_headers
    )
    assert resolve_resp.status_code == 200
    
    # Check staff history endpoint
    hist_resp = client.get(f"/api/v1/staff/complaints/{complaint_id}/history", headers=staff_headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 4
    assert history[3]["action"] == "resolved"
    assert history[3]["new_status"] == "resolved"
    assert history[3]["details"] == "Fixed it"
    
    # 5. Student provides feedback and closes
    fb_resp = client.post(
        f"/api/v1/complaints/student/{complaint_id}/feedback",
        json={"rating": 5, "comment": "Great job"},
        headers=student_headers
    )
    assert fb_resp.status_code == 201
    
    # Final check of history length
    hist_resp = client.get(f"/api/v1/complaints/student/{complaint_id}/history", headers=student_headers)
    history = hist_resp.json()
    assert len(history) == 5
    assert history[4]["action"] == "closed"
    assert history[4]["new_status"] == "closed"
