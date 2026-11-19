import pytest
from fastapi.testclient import TestClient
from main import app
from db.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.security import get_password_hash
from models.user import User, RoleEnum

# Use in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_profile.db"

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

client_instance = TestClient(app)

@pytest.fixture(scope="function", autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test users
    student = User(
        email="student@example.com",
        full_name="Student User",
        password_hash=get_password_hash("testpassword"),
        role=RoleEnum.student
    )
    
    db.add(student)
    db.commit()
    db.close()
    
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

@pytest.fixture
def client():
    return client_instance

@pytest.fixture
def student_token(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "student@example.com", "password": "testpassword"}
    )
    return response.json()["access_token"]


def test_read_profile(client: TestClient, student_token: str):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "email" in data
    assert "full_name" in data
    assert "password_hash" not in data

def test_update_profile(client: TestClient, student_token: str):
    response = client.patch(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"full_name": "Updated Name"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"

def test_update_profile_restricted_fields_ignored(client: TestClient, student_token: str):
    # Try to change role through profile update
    response = client.patch(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"full_name": "Name", "role": "admin"} # role should be ignored by Pydantic
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "student"

def test_change_password(client: TestClient, student_token: str):
    response = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "current_password": "testpassword",
            "new_password": "newtestpassword"
        }
    )
    assert response.status_code == 200

    # Verify old password no longer works
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "student@example.com", "password": "testpassword"}
    )
    assert login_res.status_code == 401

    # Verify new password works
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "student@example.com", "password": "newtestpassword"}
    )
    assert login_res.status_code == 200

def test_change_password_incorrect_current(client: TestClient, student_token: str):
    response = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "current_password": "wrongpassword",
            "new_password": "newtestpassword"
        }
    )
    assert response.status_code == 400
    assert "Incorrect current password" in response.json()["detail"]

def test_change_password_invalid_new(client: TestClient, student_token: str):
    response = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "current_password": "testpassword",
            "new_password": "   " # whitespace
        }
    )
    assert response.status_code == 422 # Pydantic validation error
