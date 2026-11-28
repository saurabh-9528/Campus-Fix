from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

from db.database import get_db
from models.user import User, RoleEnum
from schemas.user import UserRegister, UserLogin, UserResponse, UserUpdate, PasswordChange
from schemas.token import TokenResponse
from core.security import verify_password, get_password_hash, create_access_token
from api.deps import get_current_user
from sqlalchemy.exc import IntegrityError

router = APIRouter()

@router.post("/register", status_code=status.HTTP_403_FORBIDDEN)
def register():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Public registration is disabled. Accounts are managed by administrators.",
    )

@router.post("/login", response_model=TokenResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active or user.account_status != "active":
        detail = "Account is pending activation" if user.account_status == "pending_activation" else "Inactive user"
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "role": user.role.value,
        "must_change_password": user.must_change_password,
    }

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/me", response_model=UserResponse)
def update_user_me(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/change-password")
def change_password(
    password_data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )

    if current_user.must_change_password:
        if len(password_data.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters."
            )
        if password_data.new_password == password_data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current temporary password."
            )

    current_user.password_hash = get_password_hash(password_data.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"detail": "Password successfully updated."}
