from sqlalchemy.orm import Session
from models.notification import Notification, NotificationType
from models.user import User, RoleEnum

def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: NotificationType,
    complaint_id: int = None
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        complaint_id=complaint_id
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification

def notify_admins(
    db: Session,
    title: str,
    message: str,
    type: NotificationType,
    complaint_id: int = None
):
    admins = db.query(User).filter(User.role == RoleEnum.admin, User.is_active == True).all()
    for admin in admins:
        notification = Notification(
            user_id=admin.id,
            title=title,
            message=message,
            type=type,
            complaint_id=complaint_id
        )
        db.add(notification)
    if admins:
        db.commit()

def get_unread_count(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).count()

def mark_as_read(db: Session, user_id: int, notification_id: int) -> Notification:
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id
    ).first()
    
    if notification and not notification.is_read:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
        
    return notification

def mark_all_as_read(db: Session, user_id: int):
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
