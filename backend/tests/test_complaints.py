import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app
from db.database import Base, get_db
from models.user import User, RoleEnum
from core.security import get_password_hash

engine = create_engine("sqlite:///./test_complaints.db", connect_args={"check_same_thread": False})
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
    student = User(email="student1@test.com", full_name="Student", password_hash=get_password_hash("password"), role=RoleEnum.student)
    db.add(student)
    db.commit()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

def get_token(email: str):
    return client.post("/api/v1/auth/login", json={"email": email, "password": "password"}).json()["access_token"]

def test_create_complaint():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Broken pipe",
        "description": "Leaking in dorm",
        "category": "water",
        "location": "Dorm 4",
        "priority": "high"
    })
    assert response.status_code == 201

def test_list_complaints():
    token = get_token("student1@test.com")
    response = client.get("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) > 0

# --- Validation Tests ---

def test_complaint_empty_title_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "",
        "description": "Valid desc",
        "category": "water",
        "location": "Valid loc"
    })
    assert response.status_code == 422

def test_complaint_whitespace_title_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "   \n \t  ",
        "description": "Valid desc",
        "category": "water",
        "location": "Valid loc"
    })
    assert response.status_code == 422

def test_complaint_empty_description_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Valid title",
        "description": "",
        "category": "water",
        "location": "Valid loc"
    })
    assert response.status_code == 422

def test_complaint_whitespace_description_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Valid title",
        "description": "   ",
        "category": "water",
        "location": "Valid loc"
    })
    assert response.status_code == 422

def test_complaint_empty_location_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Valid title",
        "description": "Valid desc",
        "category": "water",
        "location": ""
    })
    assert response.status_code == 422

def test_complaint_whitespace_location_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Valid title",
        "description": "Valid desc",
        "category": "water",
        "location": "   "
    })
    assert response.status_code == 422

def test_complaint_title_exceeds_max_length_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "a" * 101,
        "description": "Valid desc",
        "category": "water",
        "location": "Valid loc"
    })
    assert response.status_code == 422

def test_complaint_description_exceeds_max_length_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Valid title",
        "description": "a" * 501,
        "category": "water",
        "location": "Valid loc"
    })
    assert response.status_code == 422

def test_complaint_location_exceeds_max_length_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Valid title",
        "description": "Valid desc",
        "category": "water",
        "location": "a" * 101
    })
    assert response.status_code == 422

def test_complaint_invalid_category_rejected():
    token = get_token("student1@test.com")
    response = client.post("/api/v1/complaints/student/", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Valid title",
        "description": "Valid desc",
        "category": "invalid_category",
        "location": "Valid loc"
    })
    assert response.status_code == 422
