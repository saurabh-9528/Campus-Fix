from io import BytesIO
from types import SimpleNamespace

from botocore.exceptions import ClientError, EndpointConnectionError
import pytest

from services import storage_service
from services.storage_service import (
    DatabaseStorageBackend,
    ObjectNotFoundError,
    PersistentDiskStorageBackend,
    S3StorageBackend,
    StorageConfigurationError,
    StorageError,
)


def _make_client_error(code: str, message: str = "sensitive-provider-detail") -> ClientError:
    return ClientError(
        error_response={"Error": {"Code": code, "Message": message}},
        operation_name="S3Operation",
    )


def test_s3_save_and_read_success(monkeypatch):
    calls = []
    stored = {}
    object_id = "AbCdEfGh1234567890_xyz.png"
    payload = b"\x89PNG\r\n\x1a\nfake-bytes"

    class FakeS3Client:
        def put_object(self, **kwargs):
            calls.append(("put_object", kwargs))
            stored[kwargs["Key"]] = kwargs["Body"]

        def get_object(self, **kwargs):
            calls.append(("get_object", kwargs))
            return {"Body": BytesIO(stored[kwargs["Key"]])}

    fake_client = FakeS3Client()
    monkeypatch.setattr("boto3.client", lambda **kwargs: fake_client)

    backend = S3StorageBackend(
        bucket="campusfix-test-bucket",
        region="auto",
        endpoint_url="https://example-r2.invalid",
        access_key_id="dummy-access-key",
        secret_access_key="dummy-secret-key",
        prefix="complaints",
    )

    backend.save(object_id, payload, "image/png")
    data, media_type = backend.read(object_id)

    assert calls[0] == (
        "put_object",
        {
            "Bucket": "campusfix-test-bucket",
            "Key": f"complaints/{object_id}",
            "Body": payload,
            "ContentType": "image/png",
        },
    )
    assert calls[1] == (
        "get_object",
        {
            "Bucket": "campusfix-test-bucket",
            "Key": f"complaints/{object_id}",
        },
    )
    assert data == payload
    assert media_type == "image/png"


def test_s3_read_nosuchkey_raises_object_not_found(monkeypatch):
    class FakeS3Client:
        def get_object(self, **kwargs):
            raise _make_client_error("NoSuchKey", "Key does not exist")

    monkeypatch.setattr("boto3.client", lambda **kwargs: FakeS3Client())

    backend = S3StorageBackend(
        bucket="campusfix-test-bucket",
        region="auto",
        endpoint_url=None,
        access_key_id="dummy-access-key",
        secret_access_key="dummy-secret-key",
    )

    with pytest.raises(ObjectNotFoundError):
        backend.read("AbCdEfGh1234567890_xyz.png")


@pytest.mark.parametrize(
    "exc",
    [
        _make_client_error("AccessDenied", "Access Denied for dummy-secret-key"),
        EndpointConnectionError(endpoint_url="https://secret-endpoint.invalid"),
        OSError("Network unreachable"),
    ],
)
def test_s3_failures_hide_sensitive_details(monkeypatch, exc):
    class FailingS3Client:
        def put_object(self, **kwargs):
            raise exc

        def get_object(self, **kwargs):
            raise exc

    monkeypatch.setattr("boto3.client", lambda **kwargs: FailingS3Client())

    backend = S3StorageBackend(
        bucket="campusfix-test-bucket",
        region="auto",
        endpoint_url="https://secret-endpoint.invalid",
        access_key_id="dummy-access-key",
        secret_access_key="dummy-secret-key",
    )

    for action in (
        lambda: backend.save("AbCdEfGh1234567890_xyz.jpg", b"abc", "image/jpeg"),
        lambda: backend.read("AbCdEfGh1234567890_xyz.jpg"),
    ):
        with pytest.raises(StorageError) as err_info:
            action()
        msg = str(err_info.value)
        assert "dummy-secret-key" not in msg
        assert "dummy-access-key" not in msg
        assert "secret-endpoint.invalid" not in msg


def test_get_storage_backend_requires_s3_credentials(monkeypatch):
    monkeypatch.setattr(
        storage_service,
        "settings",
        SimpleNamespace(
            STORAGE_BACKEND="s3",
            S3_BUCKET_NAME="campusfix-bucket",
            S3_REGION="auto",
            S3_ENDPOINT_URL=None,
            S3_ACCESS_KEY_ID="",
            S3_SECRET_ACCESS_KEY="",
            S3_PREFIX="complaints",
        ),
    )

    with pytest.raises(StorageConfigurationError):
        storage_service.get_storage_backend()


def test_persistent_disk_save_read_and_missing(tmp_path):
    disk_dir = tmp_path / "campusfix-uploads"
    backend = PersistentDiskStorageBackend(str(disk_dir))
    object_id = "AbCdEfGh1234567890_xyz.png"
    payload = b"\x89PNG\r\n\x1a\nfake-bytes"

    backend.save(object_id, payload, "image/png")
    data, media_type = backend.read(object_id)
    assert data == payload
    assert media_type == "image/png"

    with pytest.raises(ObjectNotFoundError):
        backend.read("ZzYyXxWw1234567890_xyz.png")

    with pytest.raises(ValueError):
        backend.read("../escape.png")


@pytest.mark.parametrize("bad_path", ["", "   ", "relative/uploads", "./uploads"])
def test_persistent_disk_requires_absolute_path(bad_path):
    with pytest.raises(StorageConfigurationError):
        PersistentDiskStorageBackend(bad_path)


def test_get_storage_backend_disk_on_render_without_s3(tmp_path, monkeypatch):
    disk_dir = tmp_path / "render-disk"
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setattr(
        storage_service,
        "settings",
        SimpleNamespace(
            STORAGE_BACKEND="disk",
            PERSISTENT_DISK_PATH=str(disk_dir),
            S3_BUCKET_NAME=None,
            S3_REGION="auto",
            S3_ENDPOINT_URL=None,
            S3_ACCESS_KEY_ID=None,
            S3_SECRET_ACCESS_KEY=None,
            S3_PREFIX="complaints",
        ),
    )

    backend = storage_service.get_storage_backend()
    assert isinstance(backend, PersistentDiskStorageBackend)


def test_database_storage_save_read_missing_duplicate_and_session_close(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from db.database import Base
    import models.uploaded_file  # noqa: F401

    db_url = f"sqlite:///{tmp_path / 'test_db_storage.db'}"
    eng = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=eng)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=eng)

    closed_count = 0

    def tracked_session():
        sess = Session()
        orig_close = sess.close

        def wrapped_close():
            nonlocal closed_count
            closed_count += 1
            orig_close()

        sess.close = wrapped_close
        return sess

    backend = DatabaseStorageBackend(session_factory=tracked_session)
    object_id = "AbCdEfGh1234567890_db.png"
    payload = b"\x89PNG\r\n\x1a\nfake-bytes"

    backend.save(object_id, payload, "image/png")
    data, media_type = backend.read(object_id)
    assert data == payload
    assert media_type == "image/png"
    assert closed_count == 2

    # Missing file
    with pytest.raises(ObjectNotFoundError):
        backend.read("ZzYyXxWw1234567890_db.png")
    assert closed_count == 3

    # Duplicate object_id triggers IntegrityError -> rollback + StorageError + close
    with pytest.raises(StorageError):
        backend.save(object_id, payload, "image/png")
    assert closed_count == 4

    eng.dispose()


def test_database_storage_rollback_and_close_on_write_failure():
    events = []

    class BrokenSession:
        def add(self, obj):
            events.append("add")

        def commit(self):
            events.append("commit")
            raise RuntimeError("SQLite/Postgres internal error: sensitive detail")

        def rollback(self):
            events.append("rollback")

        def close(self):
            events.append("close")

    backend = DatabaseStorageBackend(session_factory=BrokenSession)
    with pytest.raises(StorageError) as err_info:
        backend.save("AbCdEfGh1234567890_err.png", b"data", "image/png")

    assert "sensitive detail" not in str(err_info.value)
    assert events == ["add", "commit", "rollback", "close"]


def test_get_storage_backend_db_on_render_without_s3_or_disk(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setattr(
        storage_service,
        "settings",
        SimpleNamespace(
            STORAGE_BACKEND="db",
            PERSISTENT_DISK_PATH=None,
            S3_BUCKET_NAME=None,
            S3_REGION="auto",
            S3_ENDPOINT_URL=None,
            S3_ACCESS_KEY_ID=None,
            S3_SECRET_ACCESS_KEY=None,
            S3_PREFIX="complaints",
        ),
    )

    backend = storage_service.get_storage_backend()
    assert isinstance(backend, DatabaseStorageBackend)
