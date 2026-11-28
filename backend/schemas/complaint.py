import re
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints
from typing import Optional, Annotated, List
from datetime import datetime

_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _sanitize_text(value: str) -> str:
    cleaned = _CONTROL_CHAR_RE.sub("", value).strip()
    if not cleaned:
        raise ValueError("Value must not be empty")
    return cleaned


SanitizedStr = AfterValidator(_sanitize_text)

NonEmptyStr100 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100), SanitizedStr]
NonEmptyStr500 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500), SanitizedStr]
NonEmptyStr1000 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000), SanitizedStr]
from models.complaint import ComplaintCategory, ComplaintPriority, ComplaintStatus

class ComplaintCreate(BaseModel):
    title: NonEmptyStr100
    description: NonEmptyStr500
    category: ComplaintCategory
    location: NonEmptyStr100
    priority: Optional[ComplaintPriority] = ComplaintPriority.medium
    image_url: Optional[str] = None

class ComplaintResponse(BaseModel):
    id: int
    student_id: int
    title: str
    description: str
    category: ComplaintCategory
    location: str
    priority: ComplaintPriority
    status: ComplaintStatus
    image_url: Optional[str] = None
    assigned_staff_id: Optional[int] = None
    resolution_note: Optional[str] = None
    invalid_complaint_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ComplaintAssignmentRequest(BaseModel):
    staff_id: Optional[int] = None

class ComplaintPriorityUpdateRequest(BaseModel):
    priority: ComplaintPriority

class StaffStatusUpdateRequest(BaseModel):
    status: ComplaintStatus
    resolution_note: Optional[NonEmptyStr1000] = None


class AdminStatusUpdateRequest(BaseModel):
    status: ComplaintStatus
    resolution_note: Optional[NonEmptyStr1000] = None


class AdminBulkComplaintAssignRequest(BaseModel):
    complaint_ids: List[int] = Field(..., min_length=1, max_length=100)
    staff_id: Optional[int] = None


class AdminBulkComplaintStatusRequest(BaseModel):
    complaint_ids: List[int] = Field(..., min_length=1, max_length=100)
    status: ComplaintStatus
    resolution_note: Optional[NonEmptyStr1000] = None


class AdminBulkComplaintUpdateResponse(BaseModel):
    updated_count: int
    skipped_count: int
    complaints: List[ComplaintResponse]
