import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app
from db.database import Base, get_db
from models.user import User, RoleEnum
from models.complaint import ComplaintCategory, ComplaintPriority, ComplaintStatus, Complaint
from core.security import get_password_hash

engine = create_engine("sqlite:///./test_staff.db", connect_args={"check_same_thread": False})
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
    staff = User(email="staff1@test.com", full_name="Staff", password_hash=get_password_hash("password"), role=RoleEnum.staff)
    student = User(email="student2@test.com", full_name="Student", password_hash=get_password_hash("password"), role=RoleEnum.student)
    db.add_all([staff, student])
    db.commit()
    db.refresh(staff)
    db.refresh(student)
    comp = Complaint(student_id=student.id, title="Test", description="Test", category=ComplaintCategory.other, location="L", priority=ComplaintPriority.low, status=ComplaintStatus.assigned, assigned_staff_id=staff.id)
    db.add(comp)
    db.commit()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

def get_token(email: str):
    return client.post("/api/v1/auth/login", json={"email": email, "password": "password"}).json()["access_token"]

def test_staff_list_assigned():
    token = get_token("staff1@test.com")
    response = client.get("/api/v1/staff/complaints", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    assert len(response.json()) == 1

def test_staff_start_working():
    token = get_token("staff1@test.com")
    c_id = client.get("/api/v1/staff/complaints", headers={"Authorization": f"Bearer {token}"}).json()[0]["id"]
    res = client.patch(f"/api/v1/staff/complaints/{c_id}/status", headers={"Authorization": f"Bearer {token}"}, json={"status": "in_progress"})
    assert res.status_code == 200
    assert res.json()["status"] == "in_progress"
