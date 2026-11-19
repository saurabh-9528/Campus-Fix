from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from db.database import Base
from models.complaint import ComplaintStatus

class HistoryAction(str, enum.Enum):
    submitted = "submitted"
    assigned = "assigned"
    reassigned = "reassigned"
    unassigned = "unassigned"
    status_changed = "status_changed"
    resolved = "resolved"
    closed = "closed"

class ComplaintHistory(Base):
    __tablename__ = "complaint_history"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    action = Column(Enum(HistoryAction), nullable=False)
    
    previous_status = Column(Enum(ComplaintStatus), nullable=True)
    new_status = Column(Enum(ComplaintStatus), nullable=True)
    
    previous_assigned_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    new_assigned_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    details = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    complaint = relationship("Complaint", back_populates="history")
    actor = relationship("User", foreign_keys=[actor_id])
    previous_staff = relationship("User", foreign_keys=[previous_assigned_staff_id])
    new_staff = relationship("User", foreign_keys=[new_assigned_staff_id])
