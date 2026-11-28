# CampusFix — Product Requirements Document (PRD)

**Status:** Active Master Reference  
**Source of Truth:** CampusFix Repository (`main` branch, commit `89675da`)  
**Last Verified:** 2026-11-28

---

## 1. Project Vision & Objectives

**Vision:** Provide a reliable, transparent, role-isolated web platform for reporting, triaging, resolving, and auditing campus facility and maintenance issues.

**Core Objectives:**
- **Streamline Issue Reporting (`IMPLEMENTED`):** Enable students to submit structured maintenance complaints with category, location, priority, and optional image evidence.
- **Controlled Access & Onboarding (`IMPLEMENTED`):** Enforce administrator-managed account provisioning, disabled public self-registration, pending-activation gating for staff, and mandatory first-login password rotation.
- **Clear Accountability & Lifecycle (`IMPLEMENTED`):** Track every complaint through a strict state machine (`submitted` -> `assigned` -> `in_progress` -> `resolved` -> `closed`) with an immutable audit trail (`complaint_history`).
- **Operational Visibility (`IMPLEMENTED`):** Provide administrators with real-time complaint filtering, priority management, staff workload metrics, and student satisfaction ratings.
- **Production-Safe Persistence (`IMPLEMENTED`):** Support PostgreSQL-backed relational data and configurable persistent attachment storage (`local`, `db`, `disk`, `s3`) without relying on ephemeral container filesystems.

---

## 2. Problem Statement

Campus maintenance requests submitted via ad-hoc channels (email, paper forms, or messaging apps) suffer from:
1. Lack of structured metadata (category, location, urgency, photo evidence).
2. No single source of truth for assignment, progress, or resolution accountability.
3. No student visibility into ticket status or resolution notes.
4. Security risks when unverified users can self-register or when staff accounts share unrotated default credentials.

CampusFix solves these problems with a centralized FastAPI + React application enforcing role-based access control (RBAC), explicit state transitions, and auditable history.

---

## 3. Target Users & Roles

| Role (`RoleEnum`) | Primary Responsibilities | Portal Route Prefix | Account Provisioning Status |
| :--- | :--- | :--- | :--- |
| **Student** (`student`) | Submit complaints, upload attachments, track status/timeline, submit feedback & close resolved complaints, manage profile/password. | `/student/*` | `PARTIALLY IMPLEMENTED` (Public registration disabled; no dedicated student provisioning CLI/UI yet — `NEEDS VERIFICATION` for institutional SSO/bulk import). |
| **Staff** (`staff`) | View assigned complaints, transition `assigned` -> `in_progress` -> `resolved` with mandatory resolution note, rotate temporary password on first login. | `/staff/*` | `IMPLEMENTED` (CLI bulk/env bootstrap via `backend/staff_bootstrap.py` as `pending_activation`, activated by Admin via UI/API). |
| **Admin** (`admin`) | Triage all complaints, assign/reassign/unassign active staff, update complaint priority, activate pending staff accounts, view analytics & workload. | `/admin/*` | `IMPLEMENTED` (CLI bootstrap via `backend/admin_bootstrap.py` using `ADMIN_EMAIL` / `ADMIN_PASSWORD`). |

---

## 4. Functional Requirements

### 4.1 Authentication & Account Lifecycle
- **FR-1.1 (`IMPLEMENTED`):** Users authenticate via `POST /api/v1/auth/login` with email and password, receiving a JWT bearer token (`TokenResponse`).
- **FR-1.2 (`IMPLEMENTED`):** Public self-registration (`POST /api/v1/auth/register` and `/register` frontend route) is disabled (`HTTP 403 Forbidden` on backend; `/register` removed from `frontend/src/App.jsx` and link removed from `Login.jsx`).
- **FR-1.3 (`IMPLEMENTED`):** Users with `is_active = False` or `account_status != "active"` are blocked from logging in (`HTTP 403 Forbidden`; returns `"Account is pending activation"` when `account_status == "pending_activation"`).
- **FR-1.4 (`IMPLEMENTED`):** Staff accounts created via `staff_bootstrap.py` start with `is_active=False`, `account_status="pending_activation"`, `must_change_password=True`, and require `employee_id` and `department`.
- **FR-1.5 (`IMPLEMENTED`):** On first login with `must_change_password=True`, staff users are redirected to `/staff/change-password` (`ProtectedRoute.jsx`) and blocked from staff API endpoints (`require_staff` in `backend/api/deps.py`) until they complete `POST /api/v1/auth/change-password` with a new password (>= 8 chars, different from temporary password).
- **FR-1.6 (`PARTIALLY IMPLEMENTED`):** Authenticated users can view (`GET /api/v1/auth/me`) and update (`PATCH /api/v1/auth/me`) their profile (`full_name`) and change their password (`POST /api/v1/auth/change-password`). Note: while mandatory first-login staff password rotation enforces a minimum of 8 characters (`auth.py`), regular password changes (`must_change_password=False`) currently only check non-empty/non-whitespace and `<= 100` characters (`PasswordChange` schema). Universal >= 8-character enforcement across all password changes is a desired security requirement (`NOT IMPLEMENTED`).

### 4.2 Complaint Management (Student)
- **FR-2.1 (`IMPLEMENTED`):** Students can create complaints (`POST /api/v1/complaints/student/`) with `title`, `description`, `category` (`electrical`, `cleaning`, `internet`, `furniture`, `classroom_equipment`, `water`, `other`), `location`, `priority` (`low`, `medium`, `high`, `critical`, default `medium`), and optional `image_url`.
- **FR-2.2 (`IMPLEMENTED`):** Students can list their own complaints (`GET /api/v1/complaints/student/`) filtered by `status`, `category`, and `priority`, ordered newest first.
- **FR-2.3 (`IMPLEMENTED`):** Students can view details (`GET /api/v1/complaints/student/{id}`) and activity history (`GET /api/v1/complaints/student/{id}/history`) only for complaints they own (`HTTP 404` otherwise for data isolation).
- **FR-2.4 (`IMPLEMENTED`):** Students can submit feedback (`POST /api/v1/complaints/student/{id}/feedback` with `rating` 1–5 and optional `comment`) only when complaint status is `resolved` and no feedback exists yet. Submitting feedback automatically transitions the complaint to `closed` and records a `closed` history event.

### 4.3 Staff Workflow
- **FR-3.1 (`IMPLEMENTED`):** Active staff who have completed password rotation can list complaints assigned to them (`GET /api/v1/staff/complaints`) with optional `status`, `category`, and `priority` filters.
- **FR-3.2 (`IMPLEMENTED`):** Staff can view details (`GET /api/v1/staff/complaints/{id}`) and history (`GET /api/v1/staff/complaints/{id}/history`) only for complaints assigned to them.
- **FR-3.3 (`IMPLEMENTED`):** Staff can update complaint status (`PATCH /api/v1/staff/complaints/{id}/status`) strictly following:
  - `assigned` -> `in_progress`
  - `in_progress` -> `resolved` (requires non-empty `resolution_note` <= 1000 chars).

### 4.4 Admin Operations & Analytics
- **FR-4.1 (`IMPLEMENTED`):** Admins can list all complaints (`GET /api/v1/admin/complaints`) with `status`, `category`, `priority`, and `limit` parameters.
- **FR-4.2 (`IMPLEMENTED`):** Admins can assign, reassign, or unassign complaints (`PATCH /api/v1/admin/complaints/{id}/assign`). Only active staff (`is_active=True` and `account_status == "active"`) can be assigned. Assigning a `submitted` complaint transitions it to `assigned`. Resolved/closed complaints cannot be assigned/unassigned.
- **FR-4.3 (`IMPLEMENTED`):** Admins can update complaint priority (`PATCH /api/v1/admin/complaints/{id}/priority`) for non-resolved/non-closed complaints, recording a `ComplaintHistory` entry (`action=status_changed`, `details="Priority changed from X to Y"`).
- **FR-4.4 (`IMPLEMENTED`):** Admins can list staff (`GET /api/v1/admin/staff?include_pending=true|false`) and activate `pending_activation` staff (`PATCH /api/v1/admin/staff/{id}/activate`). Inactive (`account_status == "inactive"`) accounts are refused activation (`HTTP 400`).
- **FR-4.5 (`IMPLEMENTED`):** Admins can view analytics (`GET /api/v1/admin/analytics`) including `total_complaints`, `status_distribution`, `category_distribution`, `average_feedback_rating`, and `staff_workload` (active `assigned`/`in_progress` count per active staff).

### 4.5 Attachments & Notifications
- **FR-5.1 (`IMPLEMENTED`):** Authenticated users can upload JPEG, PNG, or WebP images up to 5 MB (`POST /api/v1/upload/`). Images are validated by magic bytes and Pillow re-encoding (stripping EXIF/metadata and blocking >25 MP decompression bombs).
- **FR-5.2 (`IMPLEMENTED`):** Uploaded files are served via `GET /api/v1/upload/files/{object_id}` only to the complaint's student owner, the assigned staff member, or an admin.
- **FR-5.3 (`IMPLEMENTED`):** In-app notifications are generated on submission, assignment, in-progress, resolution, and closure, and exposed via `GET /api/v1/notifications/`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/{id}/read`, and `PATCH /api/v1/notifications/read-all`.

---

## 5. Non-Functional Requirements

- **Security (`IMPLEMENTED`):** Bcrypt password hashing (`passlib`), HS256 JWT tokens (`ACCESS_TOKEN_EXPIRE_MINUTES = 10080`, 7 days), strict CORS origin allowlist (`FRONTEND_URLS`), magic-byte + Pillow image sanitization, and path-traversal-safe `object_id` validation.
- **Data Isolation (`IMPLEMENTED`):** Students and staff receive `HTTP 404` when requesting complaints outside their ownership/assignment.
- **Persistence (`IMPLEMENTED`):** Alembic-managed schema migrations; PostgreSQL (`pg8000`) support for production and SQLite for local development/testing.
- **Usability & Responsiveness (`IMPLEMENTED`):** Responsive sidebar drawer on mobile, desktop table + mobile card layouts in complaint lists/dashboards, inline loading spinners and alert banners.
- **Performance (`PARTIALLY IMPLEMENTED`):** Unread notification polling runs every 60 seconds (`NotificationDropdown.jsx`). Pagination (`skip`/`limit`) exists on notifications, while complaint list endpoints currently return full filtered lists (admin list supports optional `limit`).

---

## 6. Complete Feature Catalogue

| Feature | Status | Key Backend / Frontend References |
| :--- | :--- | :--- |
| JWT Auth & Profile Management | `IMPLEMENTED` | `backend/api/routers/auth.py`, `frontend/src/context/AuthContext.jsx` |
| Disabled Public Self-Registration | `IMPLEMENTED` | `POST /api/v1/auth/register` (403), `frontend/src/App.jsx`, `Login.jsx` |
| Admin CLI Bootstrap | `IMPLEMENTED` | `backend/admin_bootstrap.py` |
| Staff CLI Bootstrap (`pending_activation`) | `IMPLEMENTED` | `backend/staff_bootstrap.py` |
| Staff Admin Activation UI & API | `IMPLEMENTED` | `PATCH /api/v1/admin/staff/{id}/activate`, `frontend/src/pages/admin/StaffList.jsx` |
| Mandatory Staff First-Login Password Change | `IMPLEMENTED` | `backend/api/deps.py`, `frontend/src/pages/staff/ChangePassword.jsx` |
| Student Complaint Submission & Tracking | `IMPLEMENTED` | `backend/api/routers/complaints.py`, `frontend/src/pages/student/*` |
| Complaint Priority System | `IMPLEMENTED` | `PATCH /api/v1/admin/complaints/{id}/priority`, `PriorityBadge.jsx`, `ComplaintDetails.jsx` |
| Admin Assignment & Workload Analytics | `IMPLEMENTED` | `backend/api/routers/admin.py`, `frontend/src/pages/admin/Dashboard.jsx` |
| Staff Status State Machine & Resolution Notes | `IMPLEMENTED` | `backend/api/routers/staff.py`, `frontend/src/pages/staff/ComplaintDetails.jsx` |
| Student Feedback & Ticket Closure | `IMPLEMENTED` | `POST /api/v1/complaints/student/{id}/feedback` |
| Activity Audit Timeline | `IMPLEMENTED` | `backend/models/history.py`, `frontend/src/components/ui/ActivityTimeline.jsx` |
| Secure Image Upload & Storage Backends | `IMPLEMENTED` | `backend/api/routers/upload.py`, `backend/services/storage_service.py` |
| In-App Notifications (Polling) | `IMPLEMENTED` | `backend/api/routers/notifications.py`, `NotificationDropdown.jsx` |
| Student Bulk Provisioning / Institutional SSO | `NOT IMPLEMENTED` | No student bootstrap script or OAuth/SAML integration exists |
| Email / Push / WebSocket Real-Time Alerts | `NOT IMPLEMENTED` | Notifications are DB-backed with 60s frontend polling only |
| Admin Staff Deactivation / Role Editing UI | `NOT IMPLEMENTED` | Only pending staff activation is exposed in `admin.py` and `StaffList.jsx` |

---

## 7. User Journeys

1. **Staff Onboarding & First Login:**
   Admin runs `staff_bootstrap.py` -> Staff created as `pending_activation` (`is_active=False`, `must_change_password=True`) -> Admin opens `/admin/staff` and clicks **Activate** -> Staff logs in at `/login` -> Redirected to `/staff/change-password` -> Sets new password -> Redirected to `/staff/dashboard`.
2. **End-to-End Complaint Lifecycle:**
   Student logs in -> Creates complaint at `/student/complaints/new` (optional image uploaded to `/api/v1/upload/`) -> Admin views complaint at `/admin/complaints/:id`, optionally adjusts priority, and assigns active Staff -> Staff sees ticket in `/staff/complaints`, clicks **Start Working** (`in_progress`), then resolves with a mandatory resolution note (`resolved`) -> Student reviews resolution note at `/student/complaints/:id` and submits 1–5 star rating + comment -> Complaint transitions to `closed`.

---

## 8. Business Rules

1. **Strict State Transitions:** `submitted` -> `assigned` (admin) -> `in_progress` (assigned staff) -> `resolved` (assigned staff, resolution note required) -> `closed` (student feedback).
2. **Closed/Resolved Immutability:** Resolved or closed complaints cannot be assigned, unassigned, or have their priority changed.
3. **One Feedback Per Complaint:** Enforced by `Feedback.complaint_id` `unique=True` constraint and router check.
4. **Staff Activation Guard:** Only `pending_activation` staff can be activated via `/admin/staff/{id}/activate`; `inactive` accounts cannot be reactivated through this endpoint.
5. **Render Production Storage Guard:** `STORAGE_BACKEND=local` raises `StorageConfigurationError` when `RENDER` env var is set.

---

## 9. Acceptance Criteria (Current Release Baseline)

- All 130 automated backend `pytest` tests pass (`backend/tests/`).
- Frontend production build (`npm run build`) and linter (`npm run lint`) pass with 0 errors.
- Public registration returns `403 Forbidden`; inactive/pending users cannot obtain tokens or access protected routes.
- Staff with `must_change_password=True` cannot access `/api/v1/staff/*` until password rotation succeeds.

---

## 10. Future Scope (`PLANNED` / `NOT IMPLEMENTED`)

- **Student Provisioning Workflow:** Institutional SSO (Google/Microsoft/SAML) or CLI/Admin student onboarding to replace disabled public registration.
- **Staff Deactivation & Management:** Admin UI/API to deactivate/reactivate staff or update department metadata.
- **Server-Side Pagination & Search:** Cursor/offset pagination and full-text search on complaint lists.
- **External Notifications:** Email (SMTP/Resend) or WebSocket push notifications.
- **Export & Reporting:** CSV/PDF export of analytics and complaint history.
