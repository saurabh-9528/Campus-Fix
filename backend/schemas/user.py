from pydantic import BaseModel, EmailStr, StringConstraints, field_validator
from typing import Annotated
from datetime import datetime

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]

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
