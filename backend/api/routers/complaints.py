from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

from db.database import get_db
from models.user import User
from models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority
from schemas.complaint import ComplaintCreate, ComplaintResponse
from models.feedback import Feedback
from schemas.feedback import FeedbackCreate, FeedbackResponse
from api.deps import get_current_user, require_student
from services.notification_service import create_notification, notify_admins
from models.notification import NotificationType
from models.history import ComplaintHistory, HistoryAction
from schemas.history import ComplaintHistoryResponse

router = APIRouter()

@router.post("/", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
def create_complaint(
    complaint_in: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    db_complaint = Complaint(
        student_id=current_user.id,
        title=complaint_in.title,
        description=complaint_in.description,
        category=complaint_in.category,
        location=complaint_in.location,
        priority=complaint_in.priority,
        status=ComplaintStatus.submitted,
        image_url=complaint_in.image_url
    )
    db.add(db_complaint)
    db.flush() # flush to get the db_complaint.id

    history = ComplaintHistory(
        complaint_id=db_complaint.id,
        actor_id=current_user.id,
        action=HistoryAction.submitted,
        new_status=ComplaintStatus.submitted
    )
    db.add(history)
    db.commit()
    db.refresh(db_complaint)
    
    notify_admins(db, "New Complaint Submitted", f"A new complaint '{db_complaint.title}' has been submitted.", NotificationType.complaint_submitted, db_complaint.id)
    create_notification(db, current_user.id, "Complaint Submitted", f"Your complaint '{db_complaint.title}' has been submitted successfully.", NotificationType.complaint_submitted, db_complaint.id)
    
    return db_complaint

@router.get("/", response_model=List[ComplaintResponse])
def get_my_complaints(
    status: Optional[ComplaintStatus] = None,
    category: Optional[ComplaintCategory] = None,
    priority: Optional[ComplaintPriority] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    query = db.query(Complaint).filter(Complaint.student_id == current_user.id)
    
    if status:
        query = query.filter(Complaint.status == status)
    if category:
        query = query.filter(Complaint.category == category)
    if priority:
        query = query.filter(Complaint.priority == priority)
        
    complaints = query.order_by(Complaint.created_at.desc()).all()
    return complaints

@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint_details(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id,
        Complaint.student_id == current_user.id
    ).first()
    
    if not complaint:
        # If it doesn't exist or belongs to another student, return 404 to isolate data
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
        
    return complaint

@router.post("/{complaint_id}/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    complaint_id: int,
    feedback_in: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id,
        Complaint.student_id == current_user.id
    ).first()

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )

    existing_feedback = db.query(Feedback).filter(Feedback.complaint_id == complaint_id).first()
    if existing_feedback:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback already submitted for this complaint"
        )

    if complaint.status != ComplaintStatus.resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback can only be submitted for resolved complaints"
        )

    db_feedback = Feedback(
        complaint_id=complaint_id,
        student_id=current_user.id,
        rating=feedback_in.rating,
        comment=feedback_in.comment
    )
    db.add(db_feedback)
    
    # Update status to closed
    previous_status = complaint.status
    complaint.status = ComplaintStatus.closed
    
    history = ComplaintHistory(
        complaint_id=complaint_id,
        actor_id=current_user.id,
        action=HistoryAction.closed,
        previous_status=previous_status,
        new_status=ComplaintStatus.closed,
        details="Closed upon student feedback"
    )
    db.add(history)
    
    try:
        db.commit()
        db.refresh(db_feedback)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback already submitted for this complaint"
        )
    
    create_notification(db, current_user.id, "Complaint Closed", f"Your complaint '{complaint.title}' has been closed.", NotificationType.complaint_closed, complaint.id)
    
    return db_feedback

@router.get("/{complaint_id}/feedback", response_model=FeedbackResponse)
def get_feedback(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id,
        Complaint.student_id == current_user.id
    ).first()

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )

    feedback = db.query(Feedback).filter(Feedback.complaint_id == complaint_id).first()
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No feedback found for this complaint"
        )

    return feedback

@router.get("/{complaint_id}/history", response_model=List[ComplaintHistoryResponse])
def get_complaint_history(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student)
):
    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id,
        Complaint.student_id == current_user.id
    ).first()

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
        
    history = db.query(ComplaintHistory).filter(
        ComplaintHistory.complaint_id == complaint_id
    ).order_by(ComplaintHistory.created_at.asc()).all()
    
    return history

