import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from db.database import Base, get_db
from models.user import RoleEnum
import os

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_upload.db"
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
    Base.metadata.create_all(bind=engine)

def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()
    
def get_auth_headers(role: RoleEnum, email: str = "test@campusfix.edu"):
    # Register
    client.post("/api/v1/auth/register", json={
        "full_name": "Test User",
        "email": email,
        "password": "password123",
        "confirm_password": "password123"
    })
    
    # We need to manually update the role since register hardcodes to student
    # But for uploading an image, any student account is sufficient.
    
    # Login
    login_data = {
        "email": email,
        "password": "password123"
    }
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_upload_valid_image():
    headers = get_auth_headers(RoleEnum.student, "student_up1@campusfix.edu")
    
    # Create a dummy image
    image_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    
    files = {"file": ("test.png", image_content, "image/png")}
    response = client.post("/api/v1/upload/", headers=headers, files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert "image_url" in data
    assert "/uploads/" in data["image_url"]
    assert data["image_url"].endswith(".png")

def test_upload_unauthenticated():
    image_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    files = {"file": ("test.png", image_content, "image/png")}
    response = client.post("/api/v1/upload/", files=files)
    assert response.status_code == 401

def test_upload_unsupported_type():
    headers = get_auth_headers(RoleEnum.student, "student_up2@campusfix.edu")
    
    files = {"file": ("test.txt", b"Hello World", "text/plain")}
    response = client.post("/api/v1/upload/", headers=headers, files=files)
    
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]

def test_upload_oversized_file(monkeypatch):
    # Monkeypatch the MAX_FILE_SIZE in the router for testing
    from api.routers import upload
    monkeypatch.setattr(upload, "MAX_FILE_SIZE", 100) # 100 bytes
    
    headers = get_auth_headers(RoleEnum.student, "student_up3@campusfix.edu")
    
    image_content = b"x" * 200
    files = {"file": ("test.png", image_content, "image/png")}
    response = client.post("/api/v1/upload/", headers=headers, files=files)
    
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"]

def test_upload_filename_generation():
    headers = get_auth_headers(RoleEnum.student, "student_up4@campusfix.edu")
    
    image_content = b"\x89PNG..."
    # The client uploads a file named "malicious.sh.png"
    files = {"file": ("../../../malicious.sh.png", image_content, "image/png")}
    response = client.post("/api/v1/upload/", headers=headers, files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert "malicious" not in data["image_url"]
    assert "../" not in data["image_url"]
    assert len(data["image_url"].split("/")[-1]) > 30 # UUID is 32 chars + .png
