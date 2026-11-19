import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from db.database import Base

class NotificationType(str, enum.Enum):
    complaint_submitted = "complaint_submitted"
    complaint_assigned = "complaint_assigned"
    complaint_in_progress = "complaint_in_progress"
    complaint_resolved = "complaint_resolved"
    complaint_closed = "complaint_closed"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(SQLEnum(NotificationType), nullable=False)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=True)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User")
    complaint = relationship("Complaint")
