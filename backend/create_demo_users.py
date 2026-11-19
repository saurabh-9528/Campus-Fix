
from db.database import SessionLocal
from models.user import User, RoleEnum
from core.security import get_password_hash


def create_demo_users():
    db = SessionLocal()

    demo_users = [
        {
            "email": "student@campusfix.edu",
            "full_name": "Demo Student",
            "role": RoleEnum.student,
        },
        {
            "email": "staff@campusfix.edu",
            "full_name": "Demo Staff",
            "role": RoleEnum.staff,
        },
        {
            "email": "admin@campusfix.edu",
            "full_name": "Demo Admin",
            "role": RoleEnum.admin,
        },
    ]

    try:
        for user_data in demo_users:
            existing_user = (
                db.query(User)
                .filter(User.email == user_data["email"])
                .first()
            )

            if existing_user:
                print(f"Already exists: {user_data['email']}")
                continue

            user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                password_hash=get_password_hash("password123"),
                role=user_data["role"],
                is_active=True,
            )

            db.add(user)
            print(f"Created: {user_data['email']}")

        db.commit()
        print("Demo user setup completed successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error creating demo users: {e}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    create_demo_users()
