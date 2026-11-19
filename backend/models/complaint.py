from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from db.database import Base

class ComplaintCategory(str, enum.Enum):
    electrical = "electrical"
    cleaning = "cleaning"
    internet = "internet"
    furniture = "furniture"
    classroom_equipment = "classroom_equipment"
    water = "water"
    other = "other"

class ComplaintPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class ComplaintStatus(str, enum.Enum):
    submitted = "submitted"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    category = Column(Enum(ComplaintCategory), nullable=False)
    location = Column(String, nullable=False)
    priority = Column(Enum(ComplaintPriority), default=ComplaintPriority.medium, nullable=False)
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.submitted, nullable=False)
    image_url = Column(String, nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution_note = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("User", foreign_keys=[student_id], backref="complaints")
    assigned_staff = relationship("User", foreign_keys=[assigned_staff_id])
    history = relationship("ComplaintHistory", back_populates="complaint", cascade="all, delete-orphan")
