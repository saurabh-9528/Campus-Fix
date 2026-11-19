from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_db
from models.user import User, RoleEnum
from models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority
from schemas.complaint import ComplaintResponse, ComplaintAssignmentRequest
from schemas.user import UserResponse
from api.deps import require_admin
from services.notification_service import create_notification
from models.notification import NotificationType
from models.history import ComplaintHistory, HistoryAction
from schemas.history import ComplaintHistoryResponse
from schemas.admin_analytics import AdminAnalyticsResponse, StaffWorkload
from models.feedback import Feedback
from sqlalchemy import func, desc

router = APIRouter()

@router.get("/complaints", response_model=List[ComplaintResponse])
def get_all_complaints(
    status: Optional[ComplaintStatus] = None,
    category: Optional[ComplaintCategory] = None,
    priority: Optional[ComplaintPriority] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    query = db.query(Complaint)
    
    if status:
        query = query.filter(Complaint.status == status)
    if category:
        query = query.filter(Complaint.category == category)
    if priority:
        query = query.filter(Complaint.priority == priority)
        
    query = query.order_by(Complaint.created_at.desc())
    if limit is not None:
        query = query.limit(limit)
    return query.all()

@router.get("/complaints/{complaint_id}", response_model=ComplaintResponse)
def get_complaint_details(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
    return complaint

@router.patch("/complaints/{complaint_id}/assign", response_model=ComplaintResponse)
def assign_complaint(
    complaint_id: int,
    assignment: ComplaintAssignmentRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
    
    previous_staff_id = complaint.assigned_staff_id
    previous_status = complaint.status

    if complaint.status in [ComplaintStatus.resolved, ComplaintStatus.closed]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign or unassign a resolved or closed complaint"
        )
        
    if assignment.staff_id == previous_staff_id:
        # No-op, return successfully without duplicating history
        return complaint

    if assignment.staff_id is not None:
        staff_user = db.query(User).filter(User.id == assignment.staff_id).first()
        if not staff_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found"
            )
        if staff_user.role != RoleEnum.staff:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not a staff member"
            )
        if not staff_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Staff member is inactive"
            )
        
        complaint.assigned_staff_id = staff_user.id
        action = HistoryAction.reassigned if previous_staff_id else HistoryAction.assigned
        details = f"Assigned to {staff_user.full_name}"
        
        # Change status if it's 'submitted'
        if complaint.status == ComplaintStatus.submitted:
            complaint.status = ComplaintStatus.assigned
    else:
        # Unassign workflow
        complaint.assigned_staff_id = None
        action = HistoryAction.unassigned
        details = "Unassigned"

    history = ComplaintHistory(
        complaint_id=complaint_id,
        actor_id=current_admin.id,
        action=action,
        previous_status=previous_status,
        new_status=complaint.status,
        previous_assigned_staff_id=previous_staff_id,
        new_assigned_staff_id=complaint.assigned_staff_id,
        details=details
    )
    db.add(history)

    db.commit()
    db.refresh(complaint)
    
    if assignment.staff_id is not None:
        # Notify the newly assigned staff
        create_notification(db, staff_user.id, "New Complaint Assigned", f"You have been assigned the complaint '{complaint.title}'.", NotificationType.complaint_assigned, complaint.id)
        # Notify the student
        create_notification(db, complaint.student_id, "Complaint Assigned", f"Your complaint '{complaint.title}' has been assigned to our maintenance team.", NotificationType.complaint_assigned, complaint.id)
        
    return complaint

@router.get("/staff", response_model=List[UserResponse])
def get_active_staff(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    staff_members = db.query(User).filter(
        User.role == RoleEnum.staff,
        User.is_active == True
    ).all()
    return staff_members

@router.get("/complaints/{complaint_id}/history", response_model=List[ComplaintHistoryResponse])
def get_complaint_history(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
        
    history = db.query(ComplaintHistory).filter(
        ComplaintHistory.complaint_id == complaint_id
    ).order_by(ComplaintHistory.created_at.asc()).all()
    
    return history

@router.get("/analytics", response_model=AdminAnalyticsResponse)
def get_analytics(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    total_complaints = db.query(Complaint).count()
    
    status_counts = db.query(Complaint.status, func.count(Complaint.id)).group_by(Complaint.status).all()
    status_distribution = {status.value: count for status, count in status_counts}
    
    category_counts = db.query(Complaint.category, func.count(Complaint.id)).group_by(Complaint.category).all()
    category_distribution = {category.value: count for category, count in category_counts}
    
    avg_rating = db.query(func.avg(Feedback.rating)).scalar()
    average_feedback_rating = float(avg_rating) if avg_rating is not None else None
    
    workload_query = (
        db.query(
            User.id,
            User.full_name,
            func.count(Complaint.id).label("active_count")
        )
        .outerjoin(
            Complaint,
            (User.id == Complaint.assigned_staff_id) & 
            (Complaint.status.in_([ComplaintStatus.assigned, ComplaintStatus.in_progress]))
        )
        .filter(User.role == RoleEnum.staff, User.is_active == True)
        .group_by(User.id, User.full_name)
        .order_by(desc("active_count"))
        .all()
    )
    
    staff_workload = [
        StaffWorkload(staff_id=row.id, staff_name=row.full_name, active_complaints=row.active_count)
        for row in workload_query
    ]
    
    return AdminAnalyticsResponse(
        total_complaints=total_complaints,
        status_distribution=status_distribution,
        category_distribution=category_distribution,
        average_feedback_rating=average_feedback_rating,
        staff_workload=staff_workload
    )
