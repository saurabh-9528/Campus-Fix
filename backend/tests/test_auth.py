import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from db.database import Base, get_db
from models.user import User, RoleEnum
from core.security import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


client = TestClient(app)


def setup_module(module):
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.add_all([
        User(
            full_name="Test User",
            email="test@example.com",
            password_hash=get_password_hash("password123"),
            role=RoleEnum.student,
            is_active=True,
        ),
        User(
            full_name="Admin User",
            email="admin@example.com",
            password_hash=get_password_hash("adminpass123"),
            role=RoleEnum.admin,
            is_active=True,
        ),
        User(
            full_name="Inactive User",
            email="inactive@example.com",
            password_hash=get_password_hash("password123"),
            role=RoleEnum.student,
            is_active=False,
        ),
    ])
    db.commit()
    db.close()


def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "payload",
    [
        {"full_name": "Test User", "email": "newstudent@example.com", "password": "password123"},
        {"full_name": "Hacker Admin", "email": "hacker_admin@example.com", "password": "password123", "role": "admin"},
        {"full_name": "Hacker Staff", "email": "hacker_staff@example.com", "password": "password123", "role": "staff"},
    ],
)
def test_public_registration_disabled(payload):
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 403

    db = TestingSessionLocal()
    created = db.query(User).filter(User.email == payload["email"]).first()
    db.close()
    assert created is None


def test_login_student_and_admin():
    student_res = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert student_res.status_code == 200
    assert "access_token" in student_res.json()
    assert student_res.json()["token_type"] == "bearer"
    assert student_res.json()["role"] == "student"

    admin_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "adminpass123"},
    )
    assert admin_res.status_code == 200
    assert admin_res.json()["role"] == "admin"


def test_login_invalid_password():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_me_endpoint():
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    token = login_response.json()["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "password_hash" not in data


def test_me_endpoint_missing_token():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_endpoint_invalid_token():
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalidtoken"},
    )
    assert response.status_code == 401


def test_inactive_user_rejected_403():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "inactive@example.com", "password": "password123"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Inactive user"
