import pytest
from fastapi.testclient import TestClient
from main import app
from db.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.user import User, RoleEnum
from models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority
from models.notification import Notification, NotificationType

# Use an in-memory database for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_notifications.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
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
    
    # Create test users
    student = User(email="student@test.com", password_hash="hashed_password", full_name="Student", role=RoleEnum.student)
    admin = User(email="admin@test.com", password_hash="hashed_password", full_name="Admin", role=RoleEnum.admin)
    staff = User(email="staff@test.com", password_hash="hashed_password", full_name="Staff", role=RoleEnum.staff)
    student2 = User(email="student2@test.com", password_hash="hashed_password", full_name="Student 2", role=RoleEnum.student)
    
    db.add_all([student, admin, staff, student2])
    db.commit()
    db.close()
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)

def get_auth_headers(email="student@test.com", password="password123"):
    # Since we didn't mock the login exactly, let's just create a token 
    # Or just use the test auth route if it's easier, or mock dependency.
    pass

# We will just test the dependency overrides to mock current user
from api.deps import get_current_user, require_student, require_admin, require_staff

def mock_get_current_user(role="student", email="student@test.com"):
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == email).first()
    db.close()
    return user

def override_student(): return mock_get_current_user("student", "student@test.com")
def override_admin(): return mock_get_current_user("admin", "admin@test.com")
def override_staff(): return mock_get_current_user("staff", "staff@test.com")
def override_student2(): return mock_get_current_user("student", "student2@test.com")

def test_notification_lifecycle():
    app.dependency_overrides[require_student] = override_student
    app.dependency_overrides[require_admin] = override_admin
    app.dependency_overrides[require_staff] = override_staff
    app.dependency_overrides[get_current_user] = override_student

    # 1. Student creates complaint
    response = client.post(
        "/api/v1/complaints/student/",
        json={
            "title": "Test Complaint",
            "description": "Test",
            "category": "electrical",
            "location": "Room 101",
            "priority": "high"
        }
    )
    assert response.status_code == 201
    complaint_id = response.json()["id"]

    # Verify student notification
    response = client.get("/api/v1/notifications/")
    assert response.status_code == 200
    notifs = response.json()
    assert len(notifs) == 1
    assert notifs[0]["type"] == "complaint_submitted"
    assert notifs[0]["complaint_id"] == complaint_id

    # Verify admin notification
    app.dependency_overrides[get_current_user] = override_admin
    response = client.get("/api/v1/notifications/")
    assert response.status_code == 200
    admin_notifs = response.json()
    assert len(admin_notifs) == 1
    assert admin_notifs[0]["type"] == "complaint_submitted"
    assert admin_notifs[0]["complaint_id"] == complaint_id

    # 2. Admin assigns staff
    db = TestingSessionLocal()
    staff = db.query(User).filter(User.role == RoleEnum.staff).first()
    db.close()
    
    response = client.patch(
        f"/api/v1/admin/complaints/{complaint_id}/assign",
        json={"staff_id": staff.id}
    )
    assert response.status_code == 200

    # Verify staff notification
    app.dependency_overrides[get_current_user] = override_staff
    response = client.get("/api/v1/notifications/")
    assert response.status_code == 200
    staff_notifs = response.json()
    assert len(staff_notifs) == 1
    assert staff_notifs[0]["type"] == "complaint_assigned"

    # Verify student notification (should have 2 now)
    app.dependency_overrides[get_current_user] = override_student
    response = client.get("/api/v1/notifications/")
    student_notifs = response.json()
    assert len(student_notifs) == 2
    assert student_notifs[0]["type"] == "complaint_assigned"

    # 3. Staff starts working
    response = client.patch(
        f"/api/v1/staff/complaints/{complaint_id}/status",
        json={"status": "in_progress"}
    )
    assert response.status_code == 200

    app.dependency_overrides[get_current_user] = override_student
    response = client.get("/api/v1/notifications/")
    student_notifs = response.json()
    assert len(student_notifs) == 3
    assert student_notifs[0]["type"] == "complaint_in_progress"

    # 4. Staff resolves complaint
    app.dependency_overrides[get_current_user] = override_staff
    response = client.patch(
        f"/api/v1/staff/complaints/{complaint_id}/status",
        json={"status": "resolved", "resolution_note": "Fixed it"}
    )
    assert response.status_code == 200

    app.dependency_overrides[get_current_user] = override_student
    response = client.get("/api/v1/notifications/")
    student_notifs = response.json()
    assert len(student_notifs) == 4
    assert student_notifs[0]["type"] == "complaint_resolved"

    # 5. Read notifications
    app.dependency_overrides[get_current_user] = override_student
    response = client.get("/api/v1/notifications/unread-count")
    assert response.json()["count"] == 4

    notif_id = student_notifs[0]["id"]
    response = client.patch(f"/api/v1/notifications/{notif_id}/read")
    assert response.status_code == 200
    assert response.json()["is_read"] == True

    response = client.get("/api/v1/notifications/unread-count")
    assert response.json()["count"] == 3

    # Mark all read
    response = client.patch("/api/v1/notifications/read-all")
    assert response.status_code == 200

    response = client.get("/api/v1/notifications/unread-count")
    assert response.json()["count"] == 0

    # 6. Data Isolation
    app.dependency_overrides[get_current_user] = override_student2
    response = client.get("/api/v1/notifications/")
    assert len(response.json()) == 0
    
    # Try reading another user's notification
    response = client.patch(f"/api/v1/notifications/{notif_id}/read")
    assert response.status_code == 404

def test_notification_pagination():
    app.dependency_overrides[require_student] = override_student
    app.dependency_overrides[require_admin] = override_admin
    app.dependency_overrides[require_staff] = override_staff
    app.dependency_overrides[get_current_user] = override_student
    
    # Create multiple complaints to generate notifications
    for i in range(5):
        client.post(
            "/api/v1/complaints/student/",
            json={
                "title": f"Test Complaint {i}",
                "description": "Test",
                "category": "electrical",
                "location": "Room 101",
                "priority": "high"
            }
        )
        
    response = client.get("/api/v1/notifications/?limit=2&skip=1")
    assert response.status_code == 200
    notifs = response.json()
    assert len(notifs) == 2
