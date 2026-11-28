# CampusFix — Project Roadmap & Task Tracker

**Status:** Active Master Reference  
**Source of Truth:** CampusFix Repository (`main` branch, commit `89675da`)  
**Last Verified:** 2026-11-28

---

## 1. Phase Summary

| Phase | Scope | Status | Completion Criteria |
| :--- | :--- | :--- | :--- |
| **Phase 1: Core Auth & RBAC** | User model, JWT auth, role dependencies, profile/password | `IMPLEMENTED` | Login, `/me`, `/change-password`, role guards, `test_auth.py` & `test_profile.py` pass |
| **Phase 2: Complaint Lifecycle & History** | Student complaints, Admin assignment, Staff state machine, audit trail | `IMPLEMENTED` | Full `submitted -> closed` flow + `ComplaintHistory` verified by tests |
| **Phase 3: Feedback, Analytics & Notifications** | Student ratings, Admin analytics/workload, DB notifications + polling | `IMPLEMENTED` | `test_feedback.py`, `test_admin.py`, `test_notifications.py` pass |
| **Phase 4: Secure Uploads & Persistent Storage** | Magic-byte/Pillow sanitization, `local`/`db`/`disk`/`s3` backends | `IMPLEMENTED` | `test_upload.py`, `test_storage_service.py`, `test_config.py` pass |
| **Phase 5: Staff Onboarding, Activation & Hardening** | Staff metadata, CLI bootstraps, mandatory password change, disable public signup, priority system | `IMPLEMENTED` | Migrations `b8e2f4c19a30`, `test_staff_bootstrap.py`, `test_staff_activation.py`, `test_admin_bootstrap.py`, frontend build/lint pass |
| **Phase 6: Production Rollout & Operational Verification** | Run Alembic migrations on prod DB, bootstrap prod Admin/Staff, verify Render env | `PARTIALLY IMPLEMENTED` (`NEEDS VERIFICATION`) | Production DB at head `b8e2f4c19a30`, admin/staff active, end-to-end smoke test |
| **Phase 7: Student Provisioning & Scale Enhancements** | Student onboarding/SSO, staff deactivation UI, pagination, email/push alerts | `NOT IMPLEMENTED` | Approved design, implementation, tests, and docs updated |

---

## 2. Detailed Module-Wise Tasks

### 2.1 Backend (`backend/`)
- [x] **Auth & Security (`IMPLEMENTED`):**
  - Disable public `POST /api/v1/auth/register` (`403 Forbidden`).
  - Enforce `is_active` and `account_status == "active"` in `login` and `get_current_user`.
  - Enforce `must_change_password` block in `require_staff` and clear flag in `/change-password`.
- [x] **Staff Onboarding & Admin (`IMPLEMENTED`):**
  - Add `employee_id`, `department`, `account_status`, `must_change_password` to `User` (`b8e2f4c19a30`).
  - Implement `admin_bootstrap.py`, `staff_bootstrap.py`, and read-only `check_staff_counts.py`.
  - Implement `GET /api/v1/admin/staff?include_pending=true` and `PATCH /api/v1/admin/staff/{id}/activate`.
  - Implement `PATCH /api/v1/admin/complaints/{id}/priority`.
- [x] **Storage & Uploads (`IMPLEMENTED`):**
  - Implement `LocalStorageBackend`, `DatabaseStorageBackend`, `PersistentDiskStorageBackend`, `S3StorageBackend`.
  - Enforce 5 MB bounded read, magic-byte check, Pillow re-encoding, and role-authorized file serving.
- [ ] **Student Provisioning (`NOT IMPLEMENTED`):**
  - Decide between CLI bulk import (`student_bootstrap.py`), Admin UI creation, or institutional SSO.
- [ ] **Staff Deactivation & Pagination (`NOT IMPLEMENTED`):**
  - Add `PATCH /api/v1/admin/staff/{id}/deactivate` (or status toggle) if required.
  - Add `skip`/`limit` pagination and search filters to complaint list endpoints.

### 2.2 Frontend (`frontend/`)
- [x] **Auth & Routing (`IMPLEMENTED`):**
  - Remove `/register` route from `App.jsx` and registration link from `Login.jsx`.
  - Add `StaffChangePassword` (`/staff/change-password`) and `ProtectedRoute` redirect logic.
- [x] **Admin UI (`IMPLEMENTED`):**
  - Update `StaffList.jsx` to show `employee_id`, `department`, status badge, and **Activate** button.
  - Add Priority Management card in `admin/ComplaintDetails.jsx` and priority events in `ActivityTimeline.jsx`.
- [ ] **Cleanup & Accessibility (`NOT IMPLEMENTED`):**
  - Remove or archive unused `frontend/src/pages/auth/Register.jsx`.
  - Resolve existing `oxlint` warnings (unused imports, `set-state-in-effect`, `only-export-components`).
  - Add `aria-label` attributes to icon-only buttons (`TopBar.jsx`, `NotificationDropdown.jsx`).

---

## 3. Security, Testing & Deployment Checkpoints

### Completed Local Checkpoints (2026-11-28)
- [x] `git diff --check` passed (0 issues).
- [x] Backend `pytest` suite: `130 passed` across all 14 test files in `backend/tests/`.
- [x] Frontend `npm run lint` (`oxlint`): exited `0` (0 errors).
- [x] Frontend `npm run build` (`vite build`): exited `0`.
- [x] Changes committed (`89675da`) and pushed to `origin/main`.

### Pending Operational / Deployment Checkpoints (`NEEDS VERIFICATION`)
- [ ] Verify Render production environment variables (`SECRET_KEY`, `DATABASE_URL`, `FRONTEND_URLS`, `STORAGE_BACKEND`, `VITE_API_URL`).
- [ ] Run `alembic upgrade head` on production database (with backup taken beforehand) so `b8e2f4c19a30` is applied.
- [ ] Bootstrap initial production Admin (`admin_bootstrap.py`) and Staff (`staff_bootstrap.py`) if not already provisioned.
- [ ] Run read-only `check_staff_counts.py` and end-to-end smoke test on deployed frontend/backend.

---

## 4. Recommended Implementation Order for Next Work

1. **Production Verification & Migration:** Confirm production Alembic revision (`alembic current`) and apply `b8e2f4c19a30` if pending.
2. **Student Onboarding Design:** Define and implement how students are provisioned now that public `/register` is disabled.
3. **Frontend Hygiene:** Clean up unused `Register.jsx`, `oxlint` warnings, and missing `aria-label`s.
4. **Operational Enhancements:** Staff deactivation endpoint/UI, complaint list pagination, and optional email notifications.
