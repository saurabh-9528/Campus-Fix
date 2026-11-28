from pydantic import BaseModel, EmailStr, StringConstraints, field_validator
from typing import Annotated, List, Literal, Optional
from datetime import datetime
import re

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{2,32}$")

class UserBase(BaseModel):
    full_name: NonEmptyStr
    email: EmailStr

class UserRegister(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def validate_password_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Password must not be empty or whitespace only')
        if len(v) > 100:
            raise ValueError('Password must be at most 100 characters')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator('password')
    @classmethod
    def validate_password_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Password must not be empty or whitespace only')
        if len(v) > 100:
            raise ValueError('Password must be at most 100 characters')
        return v

class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    employee_id: str | None = None
    student_id: str | None = None
    department: str | None = None
    account_status: str = "active"
    must_change_password: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: NonEmptyStr | None = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Password must not be empty or whitespace only')
        if len(v) > 100:
            raise ValueError('Password must be at most 100 characters')
        return v


def _validate_admin_password(v: str) -> str:
    if not v or not v.strip():
        raise ValueError('Password must not be empty or whitespace only')
    if len(v) < 8:
        raise ValueError('Password must be at least 8 characters')
    if len(v) > 100:
        raise ValueError('Password must be at most 100 characters')
    return v


class AdminStaffCreate(BaseModel):
    full_name: NonEmptyStr
    email: EmailStr
    employee_id: str
    department: NonEmptyStr
    password: str
    account_status: Literal["active", "pending_activation"] = "active"

    @field_validator('email')
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator('employee_id')
    @classmethod
    def validate_employee_id(cls, v: str) -> str:
        cleaned = v.strip()
        if not ID_REGEX.fullmatch(cleaned):
            raise ValueError('Employee ID must be 2-32 characters (letters, numbers, _, -)')
        return cleaned

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_admin_password(v)


class AdminStudentCreate(BaseModel):
    full_name: NonEmptyStr
    email: EmailStr
    password: str
    student_id: Optional[str] = None
    department: Optional[str] = None

    @field_validator('email')
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator('student_id')
    @classmethod
    def validate_student_id(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        if not ID_REGEX.fullmatch(cleaned):
            raise ValueError('Student ID must be 2-32 characters (letters, numbers, _, -)')
        return cleaned

    @field_validator('department')
    @classmethod
    def validate_department(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        if len(cleaned) > 100:
            raise ValueError('Department must be at most 100 characters')
        return cleaned

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_admin_password(v)


class AdminStaffBulkCreate(BaseModel):
    items: List[AdminStaffCreate]

    @field_validator('items')
    @classmethod
    def validate_items_non_empty(cls, v: List[AdminStaffCreate]) -> List[AdminStaffCreate]:
        if not v:
            raise ValueError('At least one staff record is required')
        if len(v) > 200:
            raise ValueError('Maximum 200 records per bulk upload')
        return v


class AdminStudentBulkCreate(BaseModel):
    items: List[AdminStudentCreate]

    @field_validator('items')
    @classmethod
    def validate_items_non_empty(cls, v: List[AdminStudentCreate]) -> List[AdminStudentCreate]:
        if not v:
            raise ValueError('At least one student record is required')
        if len(v) > 200:
            raise ValueError('Maximum 200 records per bulk upload')
        return v


class AdminBulkCreateResponse(BaseModel):
    created_count: int
    users: List[UserResponse]


class UserStatusUpdate(BaseModel):
    is_active: bool


class AdminStaffResponse(UserResponse):
    active_tasks: int = 0


class AdminStudentResponse(UserResponse):
    total_complaints: int = 0
    invalid_complaint_count: int = 0
