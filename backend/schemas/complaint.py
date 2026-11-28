from pydantic import BaseModel, ConfigDict, StringConstraints
from typing import Optional, Annotated
from datetime import datetime

NonEmptyStr100 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
NonEmptyStr500 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
NonEmptyStr1000 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
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
    title: str
    description: str
    category: ComplaintCategory
    location: str
    priority: ComplaintPriority
    status: ComplaintStatus
    image_url: Optional[str] = None
    assigned_staff_id: Optional[int] = None
    resolution_note: Optional[str] = None
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
