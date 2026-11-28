from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime
from sqlalchemy.sql import func, false
import enum
from db.database import Base

class RoleEnum(str, enum.Enum):
    student = "student"
    staff = "staff"
    admin = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.student, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    employee_id = Column(String(32), unique=True, index=True, nullable=True)
    student_id = Column(String(32), unique=True, index=True, nullable=True)
    department = Column(String(100), nullable=True)
    account_status = Column(String(32), default="active", server_default="active", nullable=False)
    must_change_password = Column(Boolean, default=False, server_default=false(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
