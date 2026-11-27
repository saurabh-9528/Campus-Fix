from io import BytesIO
from types import SimpleNamespace

from botocore.exceptions import ClientError, EndpointConnectionError
import pytest

from services import storage_service
from services.storage_service import (
    ObjectNotFoundError,
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
