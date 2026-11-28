from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Literal, Optional

from db.database import get_db
from models.user import User, RoleEnum
from models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority
from schemas.complaint import (
    ComplaintResponse,
    ComplaintAssignmentRequest,
    ComplaintPriorityUpdateRequest,
    AdminStatusUpdateRequest,
    AdminBulkComplaintAssignRequest,
    AdminBulkComplaintStatusRequest,
    AdminBulkComplaintUpdateResponse,
)
from schemas.user import (
    UserResponse,
    AdminStaffCreate,
    AdminStudentCreate,
    AdminStaffBulkCreate,
    AdminStudentBulkCreate,
    AdminBulkCreateResponse,
    UserStatusUpdate,
    AdminStaffResponse,
    AdminStudentResponse,
)
from api.deps import require_admin
from core.security import get_password_hash
from services.notification_service import create_notification
from models.notification import NotificationType
from models.history import ComplaintHistory, HistoryAction
from schemas.history import ComplaintHistoryResponse
from schemas.admin_analytics import AdminAnalyticsResponse, StaffWorkload, TrendPoint
from models.feedback import Feedback
from sqlalchemy import func, desc, or_, case

router = APIRouter()

ACTIVE_TASK_STATUSES = [ComplaintStatus.assigned, ComplaintStatus.in_progress]
RESOLVED_STATUSES = [ComplaintStatus.resolved, ComplaintStatus.closed, ComplaintStatus.invalid]


def _ensure_user_fields_available(
    db: Session,
    email: str,
    employee_id: Optional[str] = None,
    student_id: Optional[str] = None,
) -> None:
    """Reject duplicate identities with clear, non-leaking error messages."""
    if db.query(User).filter(func.lower(User.email) == email.strip().lower()).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    if employee_id and db.query(User).filter(func.lower(User.employee_id) == employee_id.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This employee ID is already in use",
        )

    if student_id and db.query(User).filter(func.lower(User.student_id) == student_id.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This student ID is already in use",
        )


def _ensure_bulk_fields_available(
    db: Session,
    items: list,
    id_field: Optional[str],
    id_label: str,
) -> None:
    """Validate a whole batch before writing anything so bulk uploads stay atomic."""
    seen_emails = set()
    seen_ids = set()

    for item in items:
        email = item.email.strip().lower()
        if email in seen_emails:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate email in upload: {email}",
            )
        seen_emails.add(email)

        if id_field:
            raw_id = getattr(item, id_field)
            if raw_id:
                normalized_id = raw_id.strip().lower()
                if normalized_id in seen_ids:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Duplicate {id_label} in upload: {raw_id}",
                    )
                seen_ids.add(normalized_id)

    existing_user = (
        db.query(User)
        .filter(func.lower(User.email).in_(list(seen_emails)))
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with the email {existing_user.email} already exists",
        )

    if id_field and seen_ids:
        existing_id_user = (
            db.query(User)
            .filter(func.lower(getattr(User, id_field)).in_(list(seen_ids)))
            .first()
        )
        if existing_id_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The {id_label} {getattr(existing_id_user, id_field)} is already in use",
            )


def _build_student(payload: AdminStudentCreate) -> User:
    return User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=RoleEnum.student,
        is_active=True,
        account_status="active",
        must_change_password=False,
        student_id=payload.student_id,
        department=payload.department,
    )


def _build_staff(payload: AdminStaffCreate) -> User:
    is_active = payload.account_status == "active"
    return User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=RoleEnum.staff,
        is_active=is_active,
        account_status=payload.account_status,
        must_change_password=True,
        employee_id=payload.employee_id,
        department=payload.department,
    )


def _commit_or_conflict(db: Session, message: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def _active_task_count(db: Session, staff_id: int) -> int:
    return (
        db.query(func.count(Complaint.id))
        .filter(
            Complaint.assigned_staff_id == staff_id,
            Complaint.status.in_(ACTIVE_TASK_STATUSES),
        )
        .scalar()
        or 0
    )


def _complaint_count(db: Session, student_id: int) -> int:
    return (
        db.query(func.count(Complaint.id))
        .filter(Complaint.student_id == student_id)
        .scalar()
        or 0
    )


def _invalid_complaint_counts(db: Session, student_ids: list[int]) -> dict[int, int]:
    if not student_ids:
        return {}
    return dict(
        db.query(Complaint.student_id, func.count(Complaint.id))
        .filter(
            Complaint.student_id.in_(student_ids),
            Complaint.status == ComplaintStatus.invalid,
        )
        .group_by(Complaint.student_id)
        .all()
    )


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
    complaints = query.all()
    invalid_counts = _invalid_complaint_counts(
        db, list({complaint.student_id for complaint in complaints})
    )
    for complaint in complaints:
        complaint.invalid_complaint_count = invalid_counts.get(complaint.student_id, 0)
    return complaints

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
    complaint.invalid_complaint_count = _invalid_complaint_counts(
        db, [complaint.student_id]
    ).get(complaint.student_id, 0)
    return complaint

def _validate_assignable_staff(db: Session, staff_id: Optional[int]) -> Optional[User]:
    if staff_id is None:
        return None
    staff_user = db.query(User).filter(User.id == staff_id).first()
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
    if not staff_user.is_active or staff_user.account_status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Staff member is inactive"
        )
    return staff_user


def _apply_complaint_assignment(
    db: Session,
    complaint: Complaint,
    staff_user: Optional[User],
    actor_id: int,
) -> bool:
    """Apply assignment/unassignment to a single complaint. Returns True if modified."""
    target_staff_id = staff_user.id if staff_user else None
    previous_staff_id = complaint.assigned_staff_id
    previous_status = complaint.status

    if target_staff_id == previous_staff_id:
        return False

    if staff_user is not None:
        complaint.assigned_staff_id = staff_user.id
        action = HistoryAction.reassigned if previous_staff_id else HistoryAction.assigned
        details = f"Assigned to {staff_user.full_name}"
        if complaint.status == ComplaintStatus.submitted:
            complaint.status = ComplaintStatus.assigned
    else:
        complaint.assigned_staff_id = None
        action = HistoryAction.unassigned
        details = "Unassigned"

    db.add(
        ComplaintHistory(
            complaint_id=complaint.id,
            actor_id=actor_id,
            action=action,
            previous_status=previous_status,
            new_status=complaint.status,
            previous_assigned_staff_id=previous_staff_id,
            new_assigned_staff_id=complaint.assigned_staff_id,
            details=details,
        )
    )
    return True


def _notify_assignment(db: Session, complaint: Complaint, staff_user: Optional[User]) -> None:
    if staff_user is None:
        return
    create_notification(
        db,
        staff_user.id,
        "New Complaint Assigned",
        f"You have been assigned the complaint '{complaint.title}'.",
        NotificationType.complaint_assigned,
        complaint.id,
    )
    create_notification(
        db,
        complaint.student_id,
        "Complaint Assigned",
        f"Your complaint '{complaint.title}' has been assigned to our maintenance team.",
        NotificationType.complaint_assigned,
        complaint.id,
    )


def _apply_complaint_status_update(
    db: Session,
    complaint: Complaint,
    target_status: ComplaintStatus,
    actor_id: int,
    resolution_note: Optional[str] = None,
) -> bool:
    """Apply an admin status update and record history. Returns True if modified."""
    previous_status = complaint.status
    note_changed = resolution_note is not None and resolution_note != complaint.resolution_note

    if target_status == previous_status and not note_changed:
        return False

    complaint.status = target_status
    if resolution_note is not None:
        complaint.resolution_note = resolution_note

    if target_status == ComplaintStatus.resolved:
        action = HistoryAction.resolved
    elif target_status == ComplaintStatus.closed:
        action = HistoryAction.closed
    else:
        action = HistoryAction.status_changed

    db.add(
        ComplaintHistory(
            complaint_id=complaint.id,
            actor_id=actor_id,
            action=action,
            previous_status=previous_status,
            new_status=target_status,
            details=resolution_note,
        )
    )
    return True


def _notify_status_update(db: Session, complaint: Complaint, target_status: ComplaintStatus) -> None:
    if target_status == ComplaintStatus.in_progress:
        create_notification(
            db,
            complaint.student_id,
            "Complaint In Progress",
            f"Work has started on your complaint '{complaint.title}'.",
            NotificationType.complaint_in_progress,
            complaint.id,
        )
    elif target_status == ComplaintStatus.resolved:
        create_notification(
            db,
            complaint.student_id,
            "Complaint Resolved",
            f"Your complaint '{complaint.title}' has been resolved.",
            NotificationType.complaint_resolved,
            complaint.id,
        )
    elif target_status == ComplaintStatus.closed:
        create_notification(
            db,
            complaint.student_id,
            "Complaint Closed",
            f"Your complaint '{complaint.title}' has been closed.",
            NotificationType.complaint_closed,
            complaint.id,
        )
    elif target_status == ComplaintStatus.invalid:
        note_suffix = f" Reason: {complaint.resolution_note}" if complaint.resolution_note else ""
        create_notification(
            db,
            complaint.student_id,
            "Complaint Marked Invalid / Not Found",
            f"Your complaint '{complaint.title}' was marked Invalid / Not Found.{note_suffix}",
            NotificationType.complaint_closed,
            complaint.id,
        )


@router.patch("/complaints/bulk/assign", response_model=AdminBulkComplaintUpdateResponse)
def bulk_assign_complaints(
    payload: AdminBulkComplaintAssignRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    staff_user = _validate_assignable_staff(db, payload.staff_id)
    unique_ids = list(dict.fromkeys(payload.complaint_ids))
    complaints = db.query(Complaint).filter(Complaint.id.in_(unique_ids)).all()
    if not complaints:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching complaints found",
        )

    updated = []
    skipped = 0
    for complaint in complaints:
        if complaint.status in RESOLVED_STATUSES:
            skipped += 1
            continue
        if _apply_complaint_assignment(db, complaint, staff_user, current_admin.id):
            updated.append(complaint)
        else:
            skipped += 1

    if updated:
        db.commit()
        for complaint in updated:
            db.refresh(complaint)
            _notify_assignment(db, complaint, staff_user)

    return AdminBulkComplaintUpdateResponse(
        updated_count=len(updated),
        skipped_count=skipped + (len(unique_ids) - len(complaints)),
        complaints=updated,
    )


@router.patch("/complaints/bulk/status", response_model=AdminBulkComplaintUpdateResponse)
def bulk_update_complaint_status(
    payload: AdminBulkComplaintStatusRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    unique_ids = list(dict.fromkeys(payload.complaint_ids))
    complaints = db.query(Complaint).filter(Complaint.id.in_(unique_ids)).all()
    if not complaints:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching complaints found",
        )

    updated = []
    skipped = 0
    for complaint in complaints:
        if _apply_complaint_status_update(
            db,
            complaint,
            payload.status,
            current_admin.id,
            payload.resolution_note,
        ):
            updated.append(complaint)
        else:
            skipped += 1

    if updated:
        db.commit()
        for complaint in updated:
            db.refresh(complaint)
            _notify_status_update(db, complaint, payload.status)

    return AdminBulkComplaintUpdateResponse(
        updated_count=len(updated),
        skipped_count=skipped + (len(unique_ids) - len(complaints)),
        complaints=updated,
    )


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

    if complaint.status in RESOLVED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign or unassign a resolved or closed complaint"
        )

    staff_user = _validate_assignable_staff(db, assignment.staff_id)
    if not _apply_complaint_assignment(db, complaint, staff_user, current_admin.id):
        return complaint

    db.commit()
    db.refresh(complaint)
    _notify_assignment(db, complaint, staff_user)
    return complaint


@router.patch("/complaints/{complaint_id}/status", response_model=ComplaintResponse)
def update_complaint_status_by_admin(
    complaint_id: int,
    status_update: AdminStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )

    if not _apply_complaint_status_update(
        db,
        complaint,
        status_update.status,
        current_admin.id,
        status_update.resolution_note,
    ):
        return complaint

    db.commit()
    db.refresh(complaint)
    _notify_status_update(db, complaint, status_update.status)
    return complaint

@router.patch("/complaints/{complaint_id}/priority", response_model=ComplaintResponse)
def update_complaint_priority(
    complaint_id: int,
    priority_update: ComplaintPriorityUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )

    if complaint.status in [ComplaintStatus.resolved, ComplaintStatus.closed]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update priority of a resolved or closed complaint"
        )

    previous_priority = complaint.priority
    if priority_update.priority == previous_priority:
        return complaint

    complaint.priority = priority_update.priority
    history = ComplaintHistory(
        complaint_id=complaint_id,
        actor_id=current_admin.id,
        action=HistoryAction.status_changed,
        previous_status=None,
        new_status=None,
        details=f"Priority changed from {previous_priority.value} to {priority_update.priority.value}"
    )
    db.add(history)
    db.commit()
    db.refresh(complaint)
    return complaint

@router.get("/staff", response_model=List[AdminStaffResponse])
def get_active_staff(
    include_pending: bool = False,
    include_inactive: bool = False,
    status_filter: Optional[Literal["active", "inactive", "pending_activation"]] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    query = db.query(User).filter(User.role == RoleEnum.staff)

    if status_filter == "active":
        query = query.filter(User.is_active == True, User.account_status == "active")
    elif status_filter == "pending_activation":
        query = query.filter(User.account_status == "pending_activation")
    elif status_filter == "inactive":
        query = query.filter(User.account_status == "inactive")
    elif not include_inactive:
        # Preserve the original default: only fully active staff.
        if include_pending:
            query = query.filter(User.account_status.in_(["active", "pending_activation"]))
        else:
            query = query.filter(User.is_active == True, User.account_status == "active")

    if department:
        query = query.filter(func.lower(User.department) == department.strip().lower())

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(User.full_name).like(term),
                func.lower(User.email).like(term),
                func.lower(User.employee_id).like(term),
            )
        )

    staff_members = query.order_by(User.full_name.asc()).all()
    staff_ids = [member.id for member in staff_members]
    counts = {}
    if staff_ids:
        counts = dict(
            db.query(Complaint.assigned_staff_id, func.count(Complaint.id))
            .filter(
                Complaint.assigned_staff_id.in_(staff_ids),
                Complaint.status.in_(ACTIVE_TASK_STATUSES),
            )
            .group_by(Complaint.assigned_staff_id)
            .all()
        )

    for member in staff_members:
        member.active_tasks = counts.get(member.id, 0)

    return staff_members

@router.patch("/staff/{staff_id}/activate", response_model=UserResponse)
def activate_staff_account(
    staff_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    staff_user = db.query(User).filter(User.id == staff_id).first()
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
    if staff_user.account_status == "inactive":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot activate an inactive staff account"
        )
    if staff_user.account_status == "active" and staff_user.is_active:
        return staff_user

    staff_user.is_active = True
    staff_user.account_status = "active"
    db.commit()
    db.refresh(staff_user)
    return staff_user

@router.post("/staff", response_model=AdminStaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff_account(
    payload: AdminStaffCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    _ensure_user_fields_available(db, payload.email, employee_id=payload.employee_id)

    staff_user = _build_staff(payload)
    db.add(staff_user)
    _commit_or_conflict(db, "A user with this email or employee ID already exists")
    db.refresh(staff_user)
    staff_user.active_tasks = 0
    return staff_user

@router.post("/staff/bulk", response_model=AdminBulkCreateResponse, status_code=status.HTTP_201_CREATED)
def bulk_create_staff_accounts(
    payload: AdminStaffBulkCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    _ensure_bulk_fields_available(db, payload.items, "employee_id", "employee ID")

    staff_users = [_build_staff(item) for item in payload.items]
    db.add_all(staff_users)
    _commit_or_conflict(db, "One or more staff records conflict with existing users")

    for staff_user in staff_users:
        db.refresh(staff_user)

    return AdminBulkCreateResponse(created_count=len(staff_users), users=staff_users)

@router.patch("/staff/{staff_id}/status", response_model=AdminStaffResponse)
def update_staff_status(
    staff_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    staff_user = db.query(User).filter(User.id == staff_id).first()
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

    if payload.is_active:
        staff_user.is_active = True
        staff_user.account_status = "active"
    else:
        staff_user.is_active = False
        staff_user.account_status = "inactive"

    db.commit()
    db.refresh(staff_user)
    staff_user.active_tasks = _active_task_count(db, staff_user.id)
    return staff_user

@router.get("/students", response_model=List[AdminStudentResponse])
def get_students(
    status_filter: Optional[Literal["active", "inactive"]] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    query = db.query(User).filter(User.role == RoleEnum.student)

    if status_filter == "active":
        query = query.filter(User.is_active == True)
    elif status_filter == "inactive":
        query = query.filter(User.is_active == False)

    if department:
        query = query.filter(func.lower(User.department) == department.strip().lower())

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(User.full_name).like(term),
                func.lower(User.email).like(term),
                func.lower(User.student_id).like(term),
                func.lower(User.department).like(term),
            )
        )

    students = query.order_by(User.full_name.asc()).all()
    student_ids = [student.id for student in students]
    counts = {}
    invalid_counts = {}
    if student_ids:
        counts = dict(
            db.query(Complaint.student_id, func.count(Complaint.id))
            .filter(Complaint.student_id.in_(student_ids))
            .group_by(Complaint.student_id)
            .all()
        )
        invalid_counts = _invalid_complaint_counts(db, student_ids)

    for student in students:
        student.total_complaints = counts.get(student.id, 0)
        student.invalid_complaint_count = invalid_counts.get(student.id, 0)

    return students

@router.post("/students", response_model=AdminStudentResponse, status_code=status.HTTP_201_CREATED)
def create_student_account(
    payload: AdminStudentCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    _ensure_user_fields_available(db, payload.email, student_id=payload.student_id)

    student = _build_student(payload)
    db.add(student)
    _commit_or_conflict(db, "A user with this email or student ID already exists")
    db.refresh(student)
    student.total_complaints = 0
    return student

@router.post("/students/bulk", response_model=AdminBulkCreateResponse, status_code=status.HTTP_201_CREATED)
def bulk_create_student_accounts(
    payload: AdminStudentBulkCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    _ensure_bulk_fields_available(db, payload.items, "student_id", "student ID")

    students = [_build_student(item) for item in payload.items]
    db.add_all(students)
    _commit_or_conflict(db, "One or more student records conflict with existing users")

    for student in students:
        db.refresh(student)

    return AdminBulkCreateResponse(created_count=len(students), users=students)

@router.patch("/students/{student_id}/status", response_model=AdminStudentResponse)
def update_student_status(
    student_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    if student.role != RoleEnum.student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a student"
        )

    student.is_active = payload.is_active
    student.account_status = "active" if payload.is_active else "inactive"
    db.commit()
    db.refresh(student)
    student.total_complaints = _complaint_count(db, student.id)
    student.invalid_complaint_count = _invalid_complaint_counts(db, [student.id]).get(
        student.id, 0
    )
    return student

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

    priority_counts = db.query(Complaint.priority, func.count(Complaint.id)).group_by(Complaint.priority).all()
    priority_distribution = {priority.value: count for priority, count in priority_counts}

    avg_rating = db.query(func.avg(Feedback.rating)).scalar()
    average_feedback_rating = float(avg_rating) if avg_rating is not None else None

    # Build a per-complaint resolution timestamp. Prefer the first history entry
    # that moved the complaint into resolved/closed; fall back to updated_at for
    # records created before history tracking was introduced.
    resolved_complaints = (
        db.query(Complaint)
        .filter(Complaint.status.in_(RESOLVED_STATUSES))
        .all()
    )
    resolution_dates = {}
    history_rows = (
        db.query(ComplaintHistory.complaint_id, ComplaintHistory.created_at)
        .filter(ComplaintHistory.new_status.in_(RESOLVED_STATUSES))
        .order_by(ComplaintHistory.created_at.asc())
        .all()
    )
    for complaint_id, changed_at in history_rows:
        if complaint_id not in resolution_dates and changed_at is not None:
            resolution_dates[complaint_id] = changed_at
    for complaint in resolved_complaints:
        if complaint.id not in resolution_dates and complaint.updated_at is not None:
            resolution_dates[complaint.id] = complaint.updated_at

    resolution_durations = []
    for complaint in resolved_complaints:
        resolved_at = resolution_dates.get(complaint.id)
        if resolved_at is None or complaint.created_at is None:
            continue
        try:
            duration_hours = (resolved_at - complaint.created_at).total_seconds() / 3600
        except TypeError:
            # Defensive guard for mixed timezone-aware/naive timestamps.
            continue
        if duration_hours >= 0:
            resolution_durations.append(duration_hours)

    average_resolution_hours = (
        round(sum(resolution_durations) / len(resolution_durations), 1)
        if resolution_durations
        else None
    )

    created_dates = [
        created_at.date()
        for (created_at,) in db.query(Complaint.created_at).all()
        if created_at is not None
    ]
    resolved_dates = [
        resolved_at.date()
        for resolved_at in resolution_dates.values()
        if resolved_at is not None
    ]
    created_counter = Counter(created_dates)
    resolved_counter = Counter(resolved_dates)

    today = datetime.now(timezone.utc).date()
    daily_trend = []
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        daily_trend.append(
            TrendPoint(
                period=day.isoformat(),
                submitted=created_counter.get(day, 0),
                resolved=resolved_counter.get(day, 0),
            )
        )

    current_week_start = today - timedelta(days=today.weekday())
    weekly_trend = []
    for offset in range(7, -1, -1):
        week_start = current_week_start - timedelta(weeks=offset)
        week_end = week_start + timedelta(days=6)
        weekly_trend.append(
            TrendPoint(
                period=week_start.isoformat(),
                submitted=sum(
                    count
                    for day, count in created_counter.items()
                    if week_start <= day <= week_end
                ),
                resolved=sum(
                    count
                    for day, count in resolved_counter.items()
                    if week_start <= day <= week_end
                ),
            )
        )

    active_case = case((Complaint.status.in_(ACTIVE_TASK_STATUSES), 1), else_=0)
    resolved_case = case((Complaint.status.in_(RESOLVED_STATUSES), 1), else_=0)
    workload_query = (
        db.query(
            User.id,
            User.full_name,
            func.coalesce(func.sum(active_case), 0).label("active_count"),
            func.coalesce(func.sum(resolved_case), 0).label("resolved_count"),
            func.count(Complaint.id).label("total_assigned"),
        )
        .outerjoin(Complaint, User.id == Complaint.assigned_staff_id)
        .filter(User.role == RoleEnum.staff, User.is_active == True)
        .group_by(User.id, User.full_name)
        .order_by(desc("active_count"), desc("resolved_count"), User.full_name.asc())
        .all()
    )

    staff_workload = [
        StaffWorkload(
            staff_id=row.id,
            staff_name=row.full_name,
            active_complaints=int(row.active_count or 0),
            resolved_complaints=int(row.resolved_count or 0),
            total_assigned=int(row.total_assigned or 0),
        )
        for row in workload_query
    ]

    return AdminAnalyticsResponse(
        total_complaints=total_complaints,
        status_distribution=status_distribution,
        category_distribution=category_distribution,
        priority_distribution=priority_distribution,
        average_feedback_rating=average_feedback_rating,
        average_resolution_hours=average_resolution_hours,
        staff_workload=staff_workload,
        daily_trend=daily_trend,
        weekly_trend=weekly_trend,
    )
