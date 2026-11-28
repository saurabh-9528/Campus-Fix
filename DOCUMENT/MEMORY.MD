# CampusFix — Project Memory & Engineering Context

**Status:** Active Master Reference  
**Last Updated:** 2026-11-28

---

## 1. Project Background

CampusFix is a college campus maintenance and complaint management system built with FastAPI, SQLAlchemy/Alembic, and React (Vite + Tailwind CSS v4). Originally started as a mini-project with SQLite and open registration, it has since been hardened with persistent attachment storage options, PostgreSQL (`pg8000`) support, complaint priority management, disabled public self-registration, and a controlled staff onboarding/activation workflow.

---

## 2. Current Technology Stack

- **Backend:** Python, FastAPI `0.111.0`, SQLAlchemy `>=2.0.35`, Alembic `1.13.1`, `pg8000==1.31.2`, `scramp==1.4.18`, `passlib[bcrypt]==1.7.4`, `bcrypt==4.0.1`, `python-jose[cryptography]==3.3.0`, `pillow>=11.0.0`, `boto3>=1.35.0`.
- **Frontend:** React `^19.2.8`, React Router `^7.18.2`, Vite `^8.2.0`, Tailwind CSS `^4.3.3`, Lucide React `^1.33.0`, `oxlint` `^1.75.0`.
- **Databases:** SQLite (`sqlite:///./campusfix.db`) for local development/tests; PostgreSQL (`postgresql+pg8000://`) for production.

---

## 3. Important Architectural & Security Decisions

1. **Public Self-Registration Disabled:** `POST /api/v1/auth/register` returns `HTTP 403 Forbidden`, `/register` route is removed from `App.jsx`, and the register link is removed from `Login.jsx`.
2. **Two-Step Staff Onboarding:**
   - `backend/staff_bootstrap.py` creates staff with `is_active=False`, `account_status="pending_activation"`, `must_change_password=True`, plus `employee_id` and `department`.
   - Admins activate pending staff via `PATCH /api/v1/admin/staff/{id}/activate` (`StaffList.jsx`).
   - On first login, `ProtectedRoute.jsx` forces staff to `/staff/change-password`, and `require_staff` in `deps.py` blocks staff API access (`403`) until password rotation clears `must_change_password`.
3. **Database URL Normalization:** `core/config.py` normalizes `postgres://` and `postgresql://` to `postgresql+pg8000://`.
4. **Hardened Uploads & Pluggable Storage:** Uploads are bounded to 5 MB, verified via magic bytes + Pillow re-encoding (stripping metadata), and served only to the owning student, assigned staff, or admin via `GET /api/v1/upload/files/{object_id}`. `STORAGE_BACKEND=local` is blocked when `RENDER` env var is set.
5. **Data Isolation:** Unauthorized student/staff complaint lookups return `404` rather than `403`.
6. **Gitignore Protection:** `backend/staff_list.json`, `.env`, `*.db`, and build/cache directories are gitignored.

---

## 4. Completed Development History (Git Log)

- `f19828b` — Initial commit - Campus Fix
- `dc05db6` — Make demo user seeding safe
- `335d302` — Fix PostgreSQL DATABASE_URL normalization and duplicate complaintstatus ENUM
- `5dac6d3` — Pin scramp for pg8000 compatibility
- `f587a4f` — feat: secure complaint attachment uploads with persistent storage
- `e3f9138` — feat: add Render persistent disk storage backend
- `b03337a` — feat: add PostgreSQL database-backed upload storage
- `1f1ff7f` — Merge remote-tracking branch 'origin/main'
- `89675da` — feat: add staff onboarding, activation, priority management, and disable public registration *(latest)*

---

## 5. Current Git & Database Migration State

- **GitHub Remote:** `https://github.com/saurabh-9528/Campus-Fix.git`
- **Current Branch:** `main` (synchronized with `origin/main` at `89675daaf60b7ccebf6ee8c4704eb18a27fecf7e`)
- **Alembic Head Revision:** `b8e2f4c19a30` (`add_staff_metadata_and_activation_fields`, `down_revision = 'a7c4e9b21f10'`)
- **Local Test Status (2026-11-28):**
  - Backend `pytest`: `130 passed` (requires `SECRET_KEY` env var and `backend/requirements.txt` dependencies).
  - Frontend `npm run lint`: passed (`0` errors, warnings present).
  - Frontend `npm run build`: passed (`vite build`).

---

## 6. Known Limitations & Pending Work

While core security controls (disabled public registration, pending-activation staff gating, mandatory first-login staff password rotation, magic-byte/Pillow upload sanitization, and complaint data isolation) are `IMPLEMENTED`, the following security and operational limitations remain:

- **Regular Password Minimum Length (`PARTIALLY IMPLEMENTED`):** Mandatory 8-character password validation is enforced in `staff_bootstrap.py` and during `must_change_password` rotation in `auth.py`, but regular password changes (`must_change_password=False`) via `POST /api/v1/auth/change-password` currently lack universal >= 8-character enforcement.
- **Login Rate Limiting & Lockout (`NOT IMPLEMENTED`):** `POST /api/v1/auth/login` does not currently implement rate limiting or brute-force account lockout.
- **Student Provisioning:** Public registration is disabled, and no student bootstrap CLI or SSO integration exists yet (`create_demo_users.py` is for local dev/demo only).
- **Staff Deactivation UI/API:** Admin UI can activate `pending_activation` staff, but there is no UI/API endpoint to deactivate an active staff member or edit staff metadata.
- **Unused Legacy File:** `frontend/src/pages/auth/Register.jsx` still exists on disk even though `/register` is removed from `App.jsx`.
- **No Pagination on Complaint Lists:** Student and staff complaint list endpoints return all matching records; admin list supports `limit` but not `skip`/cursor.
- **Polling Notifications:** `NotificationDropdown.jsx` polls `/notifications/unread-count` every 60 seconds; no WebSocket or email notifications exist.
- **Production Migration State (`NEEDS VERIFICATION`):** Whether `alembic upgrade head` (`b8e2f4c19a30`) has been executed on the live Render PostgreSQL database is not verified from the local repo.

---

## 7. Exact Current Development Checkpoint

- All staff onboarding, activation, mandatory first-login password change, disabled public registration, and complaint priority system changes are **committed and pushed** to `origin/main` at commit `89675da`.
- The `DOCUMENT/` master documentation suite (`PRD.MD`, `ARCHITECTURE.MD`, `RULES.MD`, `DESIGN.MD`, `TASK.MD`, `MEMORY.MD`) has been created locally (uncommitted, per user instruction).

---

## 8. Instructions for Future AI Coding Sessions

1. **Read `DOCUMENT/` First:** Start by reviewing `MEMORY.MD`, `RULES.MD`, and `TASK.MD` before planning changes.
2. **Respect Strict Production Boundaries:** Never run migrations, connect to production DB, create real accounts, or deploy unless explicitly instructed.
3. **Environment Setup for Local Backend Tests:** Running `pytest` in `backend/` requires `SECRET_KEY` set in the environment and `backend/requirements.txt` + `pytest` installed in the active Python environment.
4. **Verify Before Reporting:** Always run `git diff --check`, `pytest`, `npm run lint`, and `npm run build` after code changes and report only observed outputs.
