from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from models.notification import NotificationType

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: NotificationType
    complaint_id: Optional[int] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
