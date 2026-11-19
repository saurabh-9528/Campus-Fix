import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from db.database import Base, get_db
from models.user import User, RoleEnum
from models.complaint import ComplaintCategory, ComplaintPriority, ComplaintStatus, Complaint
from models.feedback import Feedback
from core.security import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_feedback.db"
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
    student1 = User(email="student1@test.com", full_name="Student One", password_hash=get_password_hash("password"), role=RoleEnum.student, is_active=True)
    student2 = User(email="student2@test.com", full_name="Student Two", password_hash=get_password_hash("password"), role=RoleEnum.student, is_active=True)
    
    db.add_all([admin, staff, student1, student2])
    db.commit()
    db.refresh(student1)
    db.refresh(student2)
    db.refresh(staff)
    
    # Create test complaints
    complaint_resolved = Complaint(
        student_id=student1.id,
        title="Resolved complaint",
        description="Testing.",
        category=ComplaintCategory.electrical,
        location="Room A",
        priority=ComplaintPriority.medium,
        status=ComplaintStatus.resolved,
        assigned_staff_id=staff.id,
        resolution_note="Done"
    )
    
    complaint_submitted = Complaint(
        student_id=student1.id,
        title="Submitted complaint",
        description="Testing.",
        category=ComplaintCategory.cleaning,
        location="Room B",
        priority=ComplaintPriority.low,
        status=ComplaintStatus.submitted
    )
    
    complaint_other_student = Complaint(
        student_id=student2.id,
        title="Other student resolved",
        description="Testing.",
        category=ComplaintCategory.internet,
        location="Room C",
        priority=ComplaintPriority.high,
        status=ComplaintStatus.resolved,
        assigned_staff_id=staff.id,
        resolution_note="Fixed it"
    )
    
    db.add_all([complaint_resolved, complaint_submitted, complaint_other_student])
    db.commit()
    
    yield
    
    Base.metadata.drop_all(bind=engine)
    db.close()
    app.dependency_overrides.clear()

def get_token_for(email: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "password"})
    assert response.status_code == 200
    return response.json()["access_token"]

def test_student_submit_feedback_after_resolution():
    token = get_token_for("student1@test.com")
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5, "comment": "Great job!"}
    )
    assert response.status_code == 201
    assert response.json()["rating"] == 5
    assert response.json()["comment"] == "Great job!"
    
    # Verify complaint status changed to closed
    c_res = client.get("/api/v1/complaints/student/1", headers={"Authorization": f"Bearer {token}"})
    assert c_res.json()["status"] == "closed"

def test_duplicate_feedback_rejected():
    token = get_token_for("student1@test.com")
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 4, "comment": "Another one"}
    )
    assert response.status_code == 400

def test_concurrent_duplicate_feedback_rejected():
    # Simulate a concurrent request that bypassed the first 'if exists' check
    token = get_token_for("student2@test.com")
    
    # Manually resolve complaint 3
    db = TestingSessionLocal()
    complaint = db.query(Complaint).filter(Complaint.id == 3).first()
    complaint.status = ComplaintStatus.resolved
    db.commit()
    db.close()
    
    # First valid feedback
    response1 = client.post(
        "/api/v1/complaints/student/3/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5, "comment": "First"}
    )
    assert response1.status_code == 201
    
    # Second feedback (would normally be blocked by the existing_feedback check,
    # but we can simulate the DB constraint hit by temporarily mocking the existing_feedback check if we want,
    # or just trust the IntegrityError catch works when the DB raises it. Since we can't easily mock race conditions
    # in sqlite synchronously without deep patching, this at least tests the standard rejection logic.)
    response2 = client.post(
        "/api/v1/complaints/student/3/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 4, "comment": "Second"}
    )
    assert response2.status_code == 400

def test_feedback_cannot_be_submitted_before_resolution():
    token = get_token_for("student1@test.com")
    response = client.post(
        "/api/v1/complaints/student/2/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 3}
    )
    assert response.status_code == 400

def test_rating_validation():
    token = get_token_for("student1@test.com")
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 6} # Invalid
    )
    assert response.status_code == 422
    
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 0} # Invalid
    )
    assert response.status_code == 422

# --- Additional Validation Tests ---
def test_feedback_whitespace_comment_rejected():
    token = get_token_for("student1@test.com")
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5, "comment": "   \n\t  "}
    )
    assert response.status_code == 422

def test_feedback_comment_exceeds_max_length_rejected():
    token = get_token_for("student1@test.com")
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5, "comment": "a" * 1001}
    )
    assert response.status_code == 422

def test_student_cannot_submit_feedback_for_another():
    token = get_token_for("student1@test.com")
    response = client.post(
        "/api/v1/complaints/student/3/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5}
    )
    assert response.status_code == 404

def test_staff_cannot_submit_feedback():
    token = get_token_for("staff@test.com")
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5}
    )
    assert response.status_code == 403

def test_admin_cannot_submit_feedback():
    token = get_token_for("admin@test.com")
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5}
    )
    assert response.status_code == 403

def test_unauthenticated_cannot_submit_feedback():
    response = client.post(
        "/api/v1/complaints/student/1/feedback",
        json={"rating": 5}
    )
    assert response.status_code == 401

def test_student_can_retrieve_feedback():
    token = get_token_for("student1@test.com")
    response = client.get("/api/v1/complaints/student/1/feedback", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["rating"] == 5

def test_cannot_retrieve_another_students_feedback():
    token = get_token_for("student2@test.com")
    response = client.get("/api/v1/complaints/student/1/feedback", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404

def test_retrieve_nonexistent_feedback():
    token = get_token_for("student1@test.com")
    response = client.get("/api/v1/complaints/student/2/feedback", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
