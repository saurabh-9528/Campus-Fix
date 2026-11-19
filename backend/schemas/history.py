from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from models.complaint import ComplaintStatus
from models.history import HistoryAction

class HistoryActorResponse(BaseModel):
    id: int
    full_name: str
    role: str

    model_config = ConfigDict(from_attributes=True)

class ComplaintHistoryResponse(BaseModel):
    id: int
    complaint_id: int
    actor: HistoryActorResponse
    action: HistoryAction
    
    previous_status: Optional[ComplaintStatus] = None
    new_status: Optional[ComplaintStatus] = None
    
    previous_assigned_staff_id: Optional[int] = None
    new_assigned_staff_id: Optional[int] = None
    
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
