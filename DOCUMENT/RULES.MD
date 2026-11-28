# CampusFix — Engineering, Security & Agent Rules

**Status:** Mandatory Project Governance  
**Last Verified:** 2026-11-28

---

## 1. Mandatory Coding Standards

- **Backend (Python / FastAPI):**
  - Follow existing module boundaries: SQLAlchemy models in `backend/models/`, Pydantic schemas in `backend/schemas/`, dependencies in `backend/api/deps.py`, route handlers in `backend/api/routers/`, and reusable domain logic in `backend/services/`.
  - Validate all request payloads with Pydantic schemas; never trust raw dict inputs or client-supplied role/status fields.
  - Keep functions focused and avoid duplicating authorization or state-transition logic.
- **Frontend (React / Vite / Tailwind CSS v4):**
  - Use `apiClient` (`frontend/src/api/client.js`) and domain API wrappers (`frontend/src/api/*.js`) rather than scattered raw `fetch` calls (exception: `ComplaintAttachment.jsx` uses `fetch` for authenticated `Blob` retrieval).
  - Reuse shared UI components in `frontend/src/components/ui/` (`Card`, `Button`, `Alert`, `Badge`, `StatusBadge`, `PriorityBadge`, `Spinner`, `ActivityTimeline`).
  - Preserve `npm run lint` (`oxlint`) with 0 errors and `npm run build` (`vite build`) passing.

---

## 2. Security Requirements

- **Zero Secrets in Git:** Never commit `.env`, `backend/staff_list.json`, `*.db`, private keys, JWT `SECRET_KEY`, `DATABASE_URL`, `ADMIN_PASSWORD`, or S3 credentials.
- **Password Hashing & Strength:** Always hash passwords with `get_password_hash` (`passlib` bcrypt) in `backend/core/security.py`. All password changes (including regular user password updates, not only bootstrap and staff first-login rotation) MUST enforce a minimum length of 8 characters *(mandatory security requirement; currently only enforced on bootstrap and `must_change_password` rotation — see `MEMORY.MD`)*.
- **Public Registration Disabled:** `POST /api/v1/auth/register` MUST remain disabled (`HTTP 403 Forbidden`) unless an explicit, approved institutional onboarding design replaces it.
- **Upload Hardening:** Never bypass `_read_upload_bounded`, `_detect_image_format`, `_validate_and_sanitize_image`, or `validate_object_id` in `upload.py` / `storage_service.py`. Never serve uploaded files without verifying complaint ownership/assignment/admin role.
- **Read-Only Inspection Scripts:** Any diagnostic DB script (like `backend/check_staff_counts.py`) must enforce `SET TRANSACTION READ ONLY` and read `DATABASE_URL` strictly from environment variables.

---

## 3. Authentication & Authorization Rules

- Every protected endpoint must depend on `get_current_user`, `require_student`, `require_staff`, or `require_admin` from `backend/api/deps.py`.
- `get_current_user` must reject users where `not user.is_active or user.account_status != "active"`.
- `require_staff` must reject staff where `current_user.must_change_password` is `True` (`HTTP 403 Forbidden`).
- **Data Isolation:** Students and staff querying complaints they do not own or are not assigned to must receive `HTTP 404 Not Found` (not `403`, to avoid leaking resource existence).
- **Frontend Route Guards:** All authenticated routes must be wrapped in `ProtectedRoute` with explicit `allowedRoles`, and staff with `must_change_password === true` must be forced to `/staff/change-password`.
- **JWT Lifetime & Per-Request DB Verification:** Access tokens currently have a 7-day lifetime (`ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7` in `backend/core/config.py`) and server-side JWT revocation is not currently implemented. Therefore, `get_current_user` MUST verify `is_active` and `account_status == "active"` against the database on every authenticated request.
- **Brute-Force Protection (Required):** `POST /api/v1/auth/login` MUST enforce login rate limiting and brute-force protection *(mandatory security requirement; not yet implemented in `auth.py`)*.

---

## 4. Database & Migration Safety

- **Alembic Only:** All schema changes must be authored as Alembic migrations in `backend/alembic/versions/` with both `upgrade()` and `downgrade()` implemented.
- **SQLite Compatibility:** Use `op.batch_alter_table(...)` when altering existing tables so migrations work on both SQLite (dev/test) and PostgreSQL (prod).
- **PostgreSQL Enum Safety:** Avoid duplicate `CREATE TYPE` errors when adding or referencing SQLAlchemy `Enum` types (see commit `335d302`).
- **No Unapproved Migrations:** Never run `alembic upgrade` or `alembic downgrade` against production without explicit authorization and backup verification.

---

## 5. API Design Conventions

- Prefix all API routes with `/api/v1/<domain>`.
- Use `PATCH` for partial state and profile updates (`/auth/me`, `/assign`, `/priority`, `/status`, `/activate`, `/read`), `POST` for creation/actions, and `GET` for queries.
- Return `response_model` Pydantic schemas on all endpoints; never return raw SQLAlchemy `User` objects containing `password_hash`.
- Record a `ComplaintHistory` entry for every complaint lifecycle mutation (`submitted`, `assigned`, `reassigned`, `unassigned`, `status_changed`, `resolved`, `closed`).

---

## 6. Frontend Development Conventions

- Use React Router `NavLink` / `Link` for internal navigation; never hardcode backend origins (always use `import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'`).
- Handle loading, error, and empty states explicitly in every page (`Spinner`, `Alert`, empty-state `Card`).
- Maintain responsive layouts using Tailwind breakpoints (`sm:`, `md:`, `lg:`).

---

## 7. Testing Requirements

- **Backend (`pytest`):** All new endpoints, auth rules, state transitions, storage backends, and bootstrap scripts must have automated tests in `backend/tests/`.
- Tests must use isolated SQLite test databases (e.g., `test_*.db`, gitignored) and never touch production databases.
- **Frontend:** Run `npm run lint` and `npm run build` before considering any frontend change complete.
- Never claim tests or builds passed without executing them after the final edit and observing their output.

---

## 8. Error Handling & Logging

- Raise FastAPI `HTTPException` with accurate HTTP status codes (`400` validation/state error, `401` invalid credentials/token, `403` forbidden/inactive/password-change-required, `404` not found, `413` oversized upload, `503` storage misconfigured).
- Never leak stack traces, `SECRET_KEY`, `DATABASE_URL`, or raw SQL errors in API responses or CLI stderr messages (e.g., `admin_bootstrap.py` and `staff_bootstrap.py` catch exceptions and print sanitized error messages).
- **Privileged Account-Lifecycle Audit Logging (Required):** All privileged account-lifecycle and security-sensitive actions (including staff activation/deactivation, admin role changes, and password resets) MUST emit a persistent audit record identifying the **actor**, **action**, **target account**, and **timestamp** *(mandatory security requirement; currently only complaint lifecycle events are persisted in `complaint_history`)*.

---

## 9. Git & Version-Control Rules

- Never use `git push --force`, `git reset --hard` on shared history, or rewrite pushed commits on `main`.
- Respect `.gitignore` (`.env`, `*.db`, `__pycache__/`, `.pytest_cache/`, `backend/uploads/`, `frontend/node_modules/`, `frontend/dist/`, `backend/staff_list.json`).
- Run `git diff --check` and inspect `git status` before committing.

---

## 10. Production Deployment Restrictions

- Never connect to, migrate, seed, or modify the production database unless explicitly instructed.
- Never create real Staff, Student, or Admin accounts in production during development/documentation tasks.
- Never trigger Render deployments or modify Render environment variables without explicit user approval.
- Never use `STORAGE_BACKEND=local` in Render production (enforced by `get_storage_backend()`).

---

## 11. Rules for AI Coding Agents

- **Inspect First:** Read the actual files before assuming behavior, routes, or schemas.
- **No Unrelated Changes:** Do not refactor unrelated code, reformat untouched files, or add unrequested features without explicit approval.
- **Verify Before Claiming:** Only report file paths, symbols, and test/build results directly observed in tool output.
- **Respect Strict Boundaries:** When asked to only document or audit, do not modify application source code, run migrations, or commit/push.
