from io import BytesIO
import secrets
import warnings
from typing import Tuple

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.database import get_db
from models.complaint import Complaint
from models.user import RoleEnum, User
from services.storage_service import (
    ObjectNotFoundError,
    StorageConfigurationError,
    StorageError,
    get_storage_backend,
    validate_object_id,
)

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
CHUNK_SIZE = 64 * 1024  # 64 KB
MAX_IMAGE_PIXELS = 25_000_000  # 25 MP decompression-bomb limit


def _detect_image_format(data: bytes) -> Tuple[str, str, set[str], str]:
    """Identify image format from magic bytes rather than trusting MIME headers."""
    if data.startswith(b"\xff\xd8\xff"):
        return ("JPEG", ".jpg", {"image/jpeg", "image/jpg"}, "image/jpeg")
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ("PNG", ".png", {"image/png"}, "image/png")
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ("WEBP", ".webp", {"image/webp"}, "image/webp")
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file type. Only JPEG, PNG, and WebP are allowed.",
    )


async def _read_upload_bounded(file: UploadFile, max_bytes: int) -> bytes:
    """Stream upload in fixed chunks and abort immediately if size exceeds max_bytes."""
    buffer = bytearray()
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        buffer.extend(chunk)
        if len(buffer) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds the 5MB limit.",
            )
    if not buffer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    return bytes(buffer)


def _validate_and_sanitize_image(data: bytes, expected_format: str) -> bytes:
    """Verify image integrity, guard against decompression bombs, and strip metadata."""
    previous_max = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as verify_img:
                verify_img.verify()

            with Image.open(BytesIO(data)) as img:
                if img.format != expected_format:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid or mismatched image format.",
                    )
                img.load()
                if img.width <= 0 or img.height <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid image dimensions.",
                    )

                out = BytesIO()
                if expected_format == "JPEG":
                    if img.mode not in ("RGB", "L"):
                        img = img.convert("RGB")
                    img.save(out, format="JPEG", quality=90)
                elif expected_format == "PNG":
                    img.save(out, format="PNG")
                else:
                    img.save(out, format="WEBP", quality=90)
                return out.getvalue()
    except HTTPException:
        raise
    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        OSError,
        ValueError,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupted image file.",
        )
    finally:
        Image.MAX_IMAGE_PIXELS = previous_max


@router.post("/")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    try:
        raw_bytes = await _read_upload_bounded(file, MAX_FILE_SIZE)
    finally:
        await file.close()

    expected_format, ext, allowed_mimes, canonical_mime = _detect_image_format(raw_bytes)

    declared_type = (file.content_type or "").split(";")[0].strip().lower()
    if declared_type and declared_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match declared media type.",
        )

    sanitized_bytes = _validate_and_sanitize_image(raw_bytes, expected_format)
    object_id = f"{secrets.token_urlsafe(24)}{ext}"

    try:
        storage = get_storage_backend()
        storage.save(object_id, sanitized_bytes, canonical_mime)
    except StorageConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Object storage is not configured.",
        )
    except StorageError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file.",
        )

    base_url = str(request.base_url)
    if not base_url.endswith("/"):
        base_url += "/"
    image_url = f"{base_url}api/v1/upload/files/{object_id}"

    return {"image_url": image_url}


@router.get("/files/{object_id}")
def get_uploaded_file(
    object_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        validate_object_id(object_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file identifier.",
        )

    complaint = (
        db.query(Complaint)
        .filter(
            Complaint.image_url.isnot(None),
            Complaint.image_url.endswith(f"/{object_id}"),
        )
        .first()
    )
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    is_authorized = (
        current_user.role == RoleEnum.admin
        or (current_user.role == RoleEnum.student and complaint.student_id == current_user.id)
        or (current_user.role == RoleEnum.staff and complaint.assigned_staff_id == current_user.id)
    )
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to access this file.",
        )

    try:
        storage = get_storage_backend()
        content, media_type = storage.read(object_id)
    except ObjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )
    except StorageConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Object storage is not configured.",
        )
    except StorageError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve uploaded file.",
        )

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )
