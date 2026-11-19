import os
from db.database import SessionLocal, engine, Base
from models.user import User, RoleEnum
from core.security import get_password_hash

def create_demo_users():
    # Make sure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Create student
        student = User(
            email="student@campusfix.edu",
            full_name="Demo Student",
            password_hash=get_password_hash("password123"),
            role=RoleEnum.student,
            is_active=True
        )
        # Create staff
        staff = User(
            email="staff@campusfix.edu",
            full_name="Demo Staff",
            password_hash=get_password_hash("password123"),
            role=RoleEnum.staff,
            is_active=True
        )
        # Create admin
        admin = User(
            email="admin@campusfix.edu",
            full_name="Demo Admin",
            password_hash=get_password_hash("password123"),
            role=RoleEnum.admin,
            is_active=True
        )
        
        db.add_all([student, staff, admin])
        db.commit()
        print("Successfully created demo users:")
        print("- Student: student@campusfix.edu / password123")
        print("- Staff:   staff@campusfix.edu   / password123")
        print("- Admin:   admin@campusfix.edu   / password123")
    except Exception as e:
        db.rollback()
        print("Users might already exist or another error occurred:", e)
    finally:
        db.close()

if __name__ == "__main__":
    create_demo_users()
