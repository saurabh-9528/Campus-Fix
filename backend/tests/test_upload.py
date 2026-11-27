from io import BytesIO
import os

from fastapi.testclient import TestClient
from PIL import Image
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.security import get_password_hash
from db.database import Base, get_db
from main import app
from models.complaint import Complaint, ComplaintCategory, ComplaintPriority, ComplaintStatus
from models.user import RoleEnum, User
from services.storage_service import LocalStorageBackend, StorageError

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_upload.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def _make_image_bytes(fmt: str, size=(12, 12), mode="RGB") -> bytes:
    buf = BytesIO()
    img = Image.new(mode, size, color=(120, 45, 200))
    img.save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _isolated_storage(tmp_path, monkeypatch):
    from api.routers import upload

    storage = LocalStorageBackend(str(tmp_path / "uploads"))
    monkeypatch.setattr(upload, "get_storage_backend", lambda: storage)
    return storage


def setup_module(module):
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)


def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    app.dependency_overrides.clear()
    if os.path.exists("./test_upload.db"):
        os.remove("./test_upload.db")


def _create_user_and_headers(role: RoleEnum, email: str) -> tuple[int, dict[str, str]]:
    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                full_name=f"Test {role.value}",
                email=email,
                password_hash=get_password_hash("password123"),
                role=role,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        user_id = user.id
    finally:
        db.close()

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return user_id, {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    "fmt, filename, mime, ext",
    [
        ("JPEG", "photo.jpg", "image/jpeg", ".jpg"),
        ("PNG", "screenshot.png", "image/png", ".png"),
        ("WEBP", "evidence.webp", "image/webp", ".webp"),
    ],
)
def test_upload_valid_supported_images(fmt, filename, mime, ext):
    _, headers = _create_user_and_headers(RoleEnum.student, f"up_{fmt.lower()}@campusfix.edu")
    payload = _make_image_bytes(fmt)

    response = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": (filename, payload, mime)},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "image_url" in data
    assert "/api/v1/upload/files/" in data["image_url"]
    assert data["image_url"].endswith(ext)


def test_upload_unauthenticated():
    payload = _make_image_bytes("PNG")
    response = client.post(
        "/api/v1/upload/",
        files={"file": ("test.png", payload, "image/png")},
    )
    assert response.status_code == 401


def test_upload_unsupported_and_spoofed_mime():
    _, headers = _create_user_and_headers(RoleEnum.student, "up_spoof@campusfix.edu")

    # Plain text claiming to be PNG
    resp1 = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": ("fake.png", b"Hello World", "image/png")},
    )
    assert resp1.status_code == 400

    # Valid JPEG bytes claiming to be image/png
    jpeg_bytes = _make_image_bytes("JPEG")
    resp2 = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": ("spoof.png", jpeg_bytes, "image/png")},
    )
    assert resp2.status_code == 400
    assert "match" in resp2.json()["detail"].lower()


def test_upload_malformed_and_decompression_bomb(monkeypatch):
    from api.routers import upload

    _, headers = _create_user_and_headers(RoleEnum.student, "up_malformed@campusfix.edu")

    # Truncated PNG header
    resp_corrupt = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": ("corrupt.png", b"\x89PNG\r\n\x1a\nbad", "image/png")},
    )
    assert resp_corrupt.status_code == 400

    # Lower pixel limit to trigger decompression bomb protection safely
    monkeypatch.setattr(upload, "MAX_IMAGE_PIXELS", 100)
    big_png = _make_image_bytes("PNG", size=(20, 20))  # 400 pixels > 100
    resp_bomb = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": ("bomb.png", big_png, "image/png")},
    )
    assert resp_bomb.status_code == 400


def test_upload_oversized_file(monkeypatch):
    from api.routers import upload

    monkeypatch.setattr(upload, "MAX_FILE_SIZE", 100)
    _, headers = _create_user_and_headers(RoleEnum.student, "up_oversize@campusfix.edu")

    response = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": ("large.png", b"x" * 200, "image/png")},
    )
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"].lower()


def test_upload_filename_sanitization():
    _, headers = _create_user_and_headers(RoleEnum.student, "up_name@campusfix.edu")
    payload = _make_image_bytes("PNG")

    response = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": ("../../../malicious.sh.png", payload, "image/png")},
    )
    assert response.status_code == 200
    image_url = response.json()["image_url"]
    assert "malicious" not in image_url
    assert "../" not in image_url
    object_id = image_url.split("/")[-1]
    assert len(object_id) > 20 and object_id.endswith(".png")


def test_file_access_authorization_and_legacy_url_compatibility():
    owner_id, owner_headers = _create_user_and_headers(RoleEnum.student, "owner_up@campusfix.edu")
    _, other_student_headers = _create_user_and_headers(RoleEnum.student, "other_up@campusfix.edu")
    staff_id, staff_headers = _create_user_and_headers(RoleEnum.staff, "staff_up@campusfix.edu")
    _, other_staff_headers = _create_user_and_headers(RoleEnum.staff, "other_staff_up@campusfix.edu")
    _, admin_headers = _create_user_and_headers(RoleEnum.admin, "admin_up@campusfix.edu")

    upload_resp = client.post(
        "/api/v1/upload/",
        headers=owner_headers,
        files={"file": ("evidence.png", _make_image_bytes("PNG"), "image/png")},
    )
    assert upload_resp.status_code == 200
    image_url = upload_resp.json()["image_url"]
    object_id = image_url.split("/")[-1]

    # Public static /uploads/ is no longer exposed
    assert client.get(f"/uploads/{object_id}").status_code == 404

    # Unattached file cannot be retrieved
    assert client.get(f"/api/v1/upload/files/{object_id}", headers=owner_headers).status_code == 404

    # Attach to a complaint
    db = TestingSessionLocal()
    try:
        complaint = Complaint(
            student_id=owner_id,
            assigned_staff_id=staff_id,
            title="Broken Projector",
            description="Projector won't turn on",
            category=ComplaintCategory.classroom_equipment,
            location="Room 101",
            priority=ComplaintPriority.medium,
            status=ComplaintStatus.assigned,
            image_url=image_url,
        )
        db.add(complaint)
        db.commit()
        complaint_id = complaint.id
    finally:
        db.close()

    # Unauthenticated -> 401
    assert client.get(f"/api/v1/upload/files/{object_id}").status_code == 401
    # Unrelated student & unassigned staff -> 403
    assert client.get(f"/api/v1/upload/files/{object_id}", headers=other_student_headers).status_code == 403
    assert client.get(f"/api/v1/upload/files/{object_id}", headers=other_staff_headers).status_code == 403

    # Owner student, assigned staff, and admin -> 200
    for hdrs in (owner_headers, staff_headers, admin_headers):
        res = client.get(f"/api/v1/upload/files/{object_id}", headers=hdrs)
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert res.headers["x-content-type-options"] == "nosniff"

    # Legacy /uploads/<object_id> stored in Complaint.image_url remains accessible via protected endpoint
    db = TestingSessionLocal()
    try:
        c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        c.image_url = f"http://testserver/uploads/{object_id}"
        db.commit()
    finally:
        db.close()
    assert client.get(f"/api/v1/upload/files/{object_id}", headers=owner_headers).status_code == 200


def test_path_traversal_rejected():
    _, admin_headers = _create_user_and_headers(RoleEnum.admin, "admin_trav@campusfix.edu")
    res = client.get("/api/v1/upload/files/..%2F..%2Fetc%2Fpasswd", headers=admin_headers)
    assert res.status_code in (400, 404)


def test_storage_failure_returns_500(monkeypatch):
    from api.routers import upload

    class FailingStorage:
        def save(self, object_id, data, content_type):
            raise StorageError("Simulated outage")

        def read(self, object_id):
            raise StorageError("Simulated outage")

    monkeypatch.setattr(upload, "get_storage_backend", lambda: FailingStorage())
    _, headers = _create_user_and_headers(RoleEnum.student, "up_fail@campusfix.edu")

    res = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": ("ok.png", _make_image_bytes("PNG"), "image/png")},
    )
    assert res.status_code == 500
    assert "Failed to save" in res.json()["detail"]


def test_render_rejects_local_ephemeral_storage(monkeypatch):
    from api.routers import upload
    from services import storage_service

    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setattr(upload, "get_storage_backend", storage_service.get_storage_backend)
    monkeypatch.setattr(storage_service.settings, "STORAGE_BACKEND", "local")

    _, headers = _create_user_and_headers(RoleEnum.student, "up_render@campusfix.edu")
    res = client.post(
        "/api/v1/upload/",
        headers=headers,
        files={"file": ("ok.png", _make_image_bytes("PNG"), "image/png")},
    )
    assert res.status_code == 503
    assert "not configured" in res.json()["detail"].lower()


def test_render_persistent_disk_upload_and_authorized_download(tmp_path, monkeypatch):
    from api.routers import upload
    from services import storage_service

    disk_dir = tmp_path / "render-persistent-disk"
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setattr(upload, "get_storage_backend", storage_service.get_storage_backend)
    monkeypatch.setattr(storage_service.settings, "STORAGE_BACKEND", "disk")
    monkeypatch.setattr(storage_service.settings, "PERSISTENT_DISK_PATH", str(disk_dir))

    owner_id, owner_headers = _create_user_and_headers(RoleEnum.student, "up_disk_owner@campusfix.edu")
    _, other_headers = _create_user_and_headers(RoleEnum.student, "up_disk_other@campusfix.edu")

    upload_res = client.post(
        "/api/v1/upload/",
        headers=owner_headers,
        files={"file": ("disk.png", _make_image_bytes("PNG"), "image/png")},
    )
    assert upload_res.status_code == 200
    image_url = upload_res.json()["image_url"]
    object_id = image_url.split("/")[-1]
    assert (disk_dir / object_id).is_file()

    db = TestingSessionLocal()
    try:
        complaint = Complaint(
            student_id=owner_id,
            title="Disk Attachment Test",
            description="Testing persistent disk",
            category=ComplaintCategory.other,
            location="Lab 1",
            priority=ComplaintPriority.low,
            status=ComplaintStatus.submitted,
            image_url=image_url,
        )
        db.add(complaint)
        db.commit()
    finally:
        db.close()

    assert client.get(f"/api/v1/upload/files/{object_id}", headers=other_headers).status_code == 403
    ok_res = client.get(f"/api/v1/upload/files/{object_id}", headers=owner_headers)
    assert ok_res.status_code == 200
    assert ok_res.headers["content-type"] == "image/png"


def test_render_database_storage_upload_and_authorized_download(monkeypatch):
    from api.routers import upload
    from services import storage_service

    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setattr(storage_service, "SessionLocal", TestingSessionLocal)
    monkeypatch.setattr(upload, "get_storage_backend", storage_service.get_storage_backend)
    monkeypatch.setattr(storage_service.settings, "STORAGE_BACKEND", "db")
    monkeypatch.setattr(storage_service.settings, "PERSISTENT_DISK_PATH", None)

    owner_id, owner_headers = _create_user_and_headers(RoleEnum.student, "up_db_owner@campusfix.edu")
    _, other_headers = _create_user_and_headers(RoleEnum.student, "up_db_other@campusfix.edu")
    staff_id, staff_headers = _create_user_and_headers(RoleEnum.staff, "up_db_staff@campusfix.edu")
    _, admin_headers = _create_user_and_headers(RoleEnum.admin, "up_db_admin@campusfix.edu")

    upload_res = client.post(
        "/api/v1/upload/",
        headers=owner_headers,
        files={"file": ("db_evidence.png", _make_image_bytes("PNG"), "image/png")},
    )
    assert upload_res.status_code == 200
    image_url = upload_res.json()["image_url"]
    assert "/api/v1/upload/files/" in image_url
    object_id = image_url.split("/")[-1]

    db = TestingSessionLocal()
    try:
        complaint = Complaint(
            student_id=owner_id,
            assigned_staff_id=staff_id,
            title="DB Storage Attachment Test",
            description="Testing PostgreSQL/SQLite BYTEA storage",
            category=ComplaintCategory.other,
            location="Lab 2",
            priority=ComplaintPriority.medium,
            status=ComplaintStatus.assigned,
            image_url=image_url,
        )
        db.add(complaint)
        db.commit()
    finally:
        db.close()

    assert client.get(f"/api/v1/upload/files/{object_id}").status_code == 401
    assert client.get(f"/api/v1/upload/files/{object_id}", headers=other_headers).status_code == 403

    for hdrs in (owner_headers, staff_headers, admin_headers):
        res = client.get(f"/api/v1/upload/files/{object_id}", headers=hdrs)
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
