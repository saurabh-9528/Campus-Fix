import os
import re
from pathlib import Path
from typing import Protocol, Tuple

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from core.config import settings
from db.database import SessionLocal
from models.uploaded_file import UploadedFile

OBJECT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,128}\.(jpg|png|webp)$")

EXT_TO_MEDIA_TYPE = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

DEFAULT_LOCAL_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "uploads"
)


class StorageError(Exception):
    """Base error for storage backend failures."""


class StorageConfigurationError(StorageError):
    """Raised when object storage configuration is invalid or incomplete."""


class ObjectNotFoundError(StorageError):
    """Raised when a requested object does not exist in storage."""


def validate_object_id(object_id: str) -> str:
    """Validate that an object identifier is safe and has an allowed extension."""
    if not object_id or not OBJECT_ID_PATTERN.match(object_id):
        raise ValueError("Invalid object identifier.")
    return object_id


def media_type_for_object(object_id: str) -> str:
    """Return the canonical MIME type for a validated object identifier."""
    _, ext = os.path.splitext(object_id.lower())
    return EXT_TO_MEDIA_TYPE.get(ext, "application/octet-stream")


class StorageBackend(Protocol):
    def save(self, object_id: str, data: bytes, content_type: str) -> None: ...
    def read(self, object_id: str) -> Tuple[bytes, str]: ...


class LocalStorageBackend:
    """Local filesystem storage backend for development and automated tests."""

    def __init__(self, base_dir: str = DEFAULT_LOCAL_UPLOAD_DIR):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, object_id: str) -> Path:
        validate_object_id(object_id)
        target = (self.base_dir / object_id).resolve()
        if not target.is_relative_to(self.base_dir):
            raise ValueError("Invalid storage path.")
        return target

    def save(self, object_id: str, data: bytes, content_type: str) -> None:
        target = self._resolve_path(object_id)
        try:
            target.write_bytes(data)
        except OSError as exc:
            raise StorageError("Failed to write object to local storage.") from exc

    def read(self, object_id: str) -> Tuple[bytes, str]:
        target = self._resolve_path(object_id)
        if not target.is_file():
            raise ObjectNotFoundError("File not found.")
        try:
            return target.read_bytes(), media_type_for_object(object_id)
        except OSError as exc:
            raise StorageError("Failed to read object from local storage.") from exc


class PersistentDiskStorageBackend(LocalStorageBackend):
    """Persistent disk storage backend using a validated absolute mount path (e.g., Render Disk)."""

    def __init__(self, mount_path: str):
        if not mount_path or not mount_path.strip():
            raise StorageConfigurationError(
                "PERSISTENT_DISK_PATH must be set when STORAGE_BACKEND=disk."
            )
        candidate = Path(mount_path.strip())
        if not candidate.is_absolute():
            raise StorageConfigurationError(
                "PERSISTENT_DISK_PATH must be an absolute path."
            )
        try:
            super().__init__(str(candidate))
        except OSError as exc:
            raise StorageConfigurationError(
                "Persistent disk mount path is not accessible."
            ) from exc


class S3StorageBackend:
    """S3-compatible object storage backend (AWS S3, Cloudflare R2, MinIO, etc.)."""

    def __init__(
        self,
        bucket: str,
        region: str,
        endpoint_url: str | None,
        access_key_id: str,
        secret_access_key: str,
        prefix: str = "complaints",
    ):
        self.bucket = bucket
        self.prefix = prefix.strip("/")
        try:
            import boto3
        except ImportError as exc:
            raise StorageConfigurationError("boto3 is required for S3 storage.") from exc

        client_kwargs = {
            "service_name": "s3",
            "region_name": region or "auto",
            "aws_access_key_id": access_key_id,
            "aws_secret_access_key": secret_access_key,
        }
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url
        self.client = boto3.client(**client_kwargs)

    def _object_key(self, object_id: str) -> str:
        validate_object_id(object_id)
        return f"{self.prefix}/{object_id}" if self.prefix else object_id

    def save(self, object_id: str, data: bytes, content_type: str) -> None:
        key = self._object_key(object_id)
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        except Exception as exc:
            raise StorageError("Failed to store object in S3 storage.") from exc

    def read(self, object_id: str) -> Tuple[bytes, str]:
        key = self._object_key(object_id)
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
            body = response["Body"].read()
            return body, media_type_for_object(object_id)
        except Exception as exc:
            error_code = getattr(exc, "response", {}).get("Error", {}).get("Code")
            if error_code in {"NoSuchKey", "404", "NotFound"}:
                raise ObjectNotFoundError("File not found.") from exc
            raise StorageError("Failed to retrieve object from S3 storage.") from exc


class DatabaseStorageBackend:
    """Database-backed storage using SQLAlchemy LargeBinary (PostgreSQL BYTEA / SQLite BLOB)."""

    def __init__(self, session_factory=None):
        self.session_factory = session_factory

    def _new_session(self):
        factory = self.session_factory or SessionLocal
        return factory()

    def save(self, object_id: str, data: bytes, content_type: str) -> None:
        validate_object_id(object_id)
        db = self._new_session()
        try:
            record = UploadedFile(
                object_id=object_id,
                content_type=content_type,
                size_bytes=len(data),
                data=data,
            )
            db.add(record)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise StorageError("Duplicate object identifier.") from exc
        except SQLAlchemyError as exc:
            db.rollback()
            raise StorageError("Failed to store object in database storage.") from exc
        except Exception as exc:
            db.rollback()
            raise StorageError("Failed to store object in database storage.") from exc
        finally:
            db.close()

    def read(self, object_id: str) -> Tuple[bytes, str]:
        validate_object_id(object_id)
        db = self._new_session()
        try:
            record = (
                db.query(UploadedFile)
                .filter(UploadedFile.object_id == object_id)
                .first()
            )
            if record is None:
                raise ObjectNotFoundError("File not found.")
            return bytes(record.data), record.content_type
        except ObjectNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise StorageError("Failed to retrieve object from database storage.") from exc
        finally:
            db.close()


def get_storage_backend() -> StorageBackend:
    """Return the configured storage backend."""
    backend_name = (settings.STORAGE_BACKEND or "local").strip().lower()
    if os.getenv("RENDER") and backend_name == "local":
        raise StorageConfigurationError(
            "Ephemeral local storage is not allowed in Render production. Configure STORAGE_BACKEND=db, disk, or s3."
        )
    if backend_name == "local":
        return LocalStorageBackend()
    if backend_name == "db":
        return DatabaseStorageBackend()
    if backend_name == "disk":
        return PersistentDiskStorageBackend(settings.PERSISTENT_DISK_PATH or "")
    if backend_name == "s3":
        if not (
            settings.S3_BUCKET_NAME
            and settings.S3_ACCESS_KEY_ID
            and settings.S3_SECRET_ACCESS_KEY
        ):
            raise StorageConfigurationError(
                "S3 storage backend requires S3_BUCKET_NAME, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY."
            )
        return S3StorageBackend(
            bucket=settings.S3_BUCKET_NAME,
            region=settings.S3_REGION,
            endpoint_url=settings.S3_ENDPOINT_URL,
            access_key_id=settings.S3_ACCESS_KEY_ID,
            secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            prefix=settings.S3_PREFIX,
        )
    raise StorageConfigurationError(f"Unsupported STORAGE_BACKEND: {backend_name}")
