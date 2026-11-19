from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_db
from models.user import User
from models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority
from schemas.complaint import ComplaintResponse, StaffStatusUpdateRequest
from api.deps import require_staff
from services.notification_service import create_notification, notify_admins
from models.notification import NotificationType
from models.history import ComplaintHistory, HistoryAction
from schemas.history import ComplaintHistoryResponse

router = APIRouter()

@router.get("/complaints", response_model=List[ComplaintResponse])
def get_staff_complaints(
    status: Optional[ComplaintStatus] = None,
    category: Optional[ComplaintCategory] = None,
    priority: Optional[ComplaintPriority] = None,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff)
):
    query = db.query(Complaint).filter(Complaint.assigned_staff_id == current_staff.id)
    
    if status:
        query = query.filter(Complaint.status == status)
    if category:
        query = query.filter(Complaint.category == category)
    if priority:
        query = query.filter(Complaint.priority == priority)
        
    complaints = query.order_by(Complaint.created_at.desc()).all()
    return complaints

@router.get("/complaints/{complaint_id}", response_model=ComplaintResponse)
def get_staff_complaint_details(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff)
):
    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id,
        Complaint.assigned_staff_id == current_staff.id
    ).first()
    
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found or not assigned to you"
        )
    return complaint

@router.patch("/complaints/{complaint_id}/status", response_model=ComplaintResponse)
def update_complaint_status(
    complaint_id: int,
    update_req: StaffStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff)
):
    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id,
        Complaint.assigned_staff_id == current_staff.id
    ).first()
    
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found or not assigned to you"
        )

    # State machine rules
    current_status = complaint.status
    target_status = update_req.status

    if current_status == ComplaintStatus.assigned and target_status == ComplaintStatus.in_progress:
        pass
    elif current_status == ComplaintStatus.in_progress and target_status == ComplaintStatus.resolved:
        if not update_req.resolution_note or len(update_req.resolution_note.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A resolution note is required when resolving a complaint"
            )
        if len(update_req.resolution_note) > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Resolution note is too long"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from {current_status.value} to {target_status.value}"
        )

    complaint.status = target_status
    if update_req.resolution_note is not None:
        complaint.resolution_note = update_req.resolution_note

    action = HistoryAction.resolved if target_status == ComplaintStatus.resolved else HistoryAction.status_changed
    history = ComplaintHistory(
        complaint_id=complaint_id,
        actor_id=current_staff.id,
        action=action,
        previous_status=current_status,
        new_status=target_status,
        details=update_req.resolution_note if target_status == ComplaintStatus.resolved else None
    )
    db.add(history)

    db.commit()
    db.refresh(complaint)
    
    if target_status == ComplaintStatus.in_progress:
        create_notification(db, complaint.student_id, "Complaint In Progress", f"Work has started on your complaint '{complaint.title}'.", NotificationType.complaint_in_progress, complaint.id)
    elif target_status == ComplaintStatus.resolved:
        create_notification(db, complaint.student_id, "Complaint Resolved", f"Your complaint '{complaint.title}' has been resolved.", NotificationType.complaint_resolved, complaint.id)
        # Optional: notify admin that it was resolved.
        notify_admins(db, "Complaint Resolved", f"The complaint '{complaint.title}' has been marked as resolved by staff.", NotificationType.complaint_resolved, complaint.id)

    return complaint

@router.get("/complaints/{complaint_id}/history", response_model=List[ComplaintHistoryResponse])
def get_staff_complaint_history(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff)
):
    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id,
        Complaint.assigned_staff_id == current_staff.id
    ).first()
    
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found or not assigned to you"
        )
        
    history = db.query(ComplaintHistory).filter(
        ComplaintHistory.complaint_id == complaint_id
    ).order_by(ComplaintHistory.created_at.asc()).all()
    
    return history
