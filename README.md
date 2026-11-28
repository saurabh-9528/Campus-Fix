# CampusFix — Campus Maintenance & Complaint Management System

CampusFix is a full-stack, multi-role web application built for reporting, triaging, verifying, and resolving campus infrastructure issues across **Student**, **Staff**, and **Admin** workflows.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS v4, React Router
- **Backend**: FastAPI (Python), SQLAlchemy (ORM), Alembic
- **Database**: SQLite (default for local development) / PostgreSQL (production via `postgresql+pg8000`)
- **Authentication**: JWT Bearer tokens with strict role-based access control (RBAC)

---

## Role Workflows & Features

### Student (`/student/*`)
- **Interactive Complaint Submission (`/student/complaints/new`)**:
  - Interactive `CampusMapPicker` for placing and resetting a campus location pin, with `Use Current Location` bounds clamping (`clampX` / `clampY`) and an outside-campus note when coordinates fall outside campus bounds.
  - Single-select quick-zone chips (`Hostel Block`, `Academic Block`, `Library`, `Cafeteria`, `Sports Complex`) that replace the active zone (or toggle off when clicked again) while keeping the `Location` field editable for room/floor details.
  - Accountability Notice reminding students that false or prank reports are tracked.
  - Validated image uploads (`JPEG`, `PNG`, `WEBP`, `<= 5MB`).
- **Complaint Tracking (`/student/complaints`)**:
  - Search by title, location, or ticket ID and filter with synced status pills (`All`, `Pending`, `In Progress`, `Resolved`, `Invalid / Not Found`).
  - Stage progress indicator (`Submitted` -> `Assigned` -> `In Progress` -> `Resolved` / `Invalid / Not Found`), resolution/verification notes, and post-resolution feedback.

### Staff (`/staff/*`)
- **Operations Dashboard (`/staff/dashboard`)**:
  - 4 KPI summary cards, priority-sorted active assignments (`Critical` and `High` first) with an urgent count badge, `Pin attached` coordinate indicator, one-click `Start Work` (`assigned` -> `in_progress`), and a Completion Summary panel.
- **Assigned Queue & Ticket Details (`/staff/complaints`, `/staff/complaints/:id`)**:
  - Filterable queue (`Assigned`, `In Progress`, `High/Critical`, `Resolved`).
  - Field verification actions to mark tickets `Resolved` or `Invalid / Not Found` with a required non-empty verification/resolution note.
- **Read-Only Profile (`/staff/profile`)**:
  - Displays staff metadata without self-service password controls.

### Admin (`/admin/*`)
- **Triage & Assignment (`/admin/complaints`)**:
  - Inspect all campus tickets, filter/search, assign or bulk-assign tickets to staff, and review detailed timelines in the complaint drawer.
- **Anti-Prank / Repeat-Offender Flagging (`/admin/complaints`, `/admin/students`)**:
  - Tracks `invalid_complaint_count` per student and surfaces `{count} Invalid` warning badges when `invalid_complaint_count >= 2`.
- **Account Management (`/admin/students`, `/admin/staff`)**:
  - Create and activate/deactivate student and staff accounts (admins cannot deactivate their own account).

---

## Security & Hardening
- **RBAC & Object-Level Ownership (IDOR Prevention)**:
  - Students can only access their own complaints and cannot modify statuses or verification notes.
  - Staff can only view and update complaints explicitly assigned to them (`assigned_staff_id == current_user.id`).
  - Deactivated accounts (`is_active == False`) are rejected immediately on authenticated API requests.
- **Upload & Input Safety**:
  - Complaint image uploads enforce `JPEG`, `PNG`, and `WEBP` MIME + Pillow header/signature checks, `<= 5MB` size limits, EXIF stripping, and randomized filenames.
  - Pydantic schemas enforce length bounds and strip control characters across text fields.
- **HTTP & Session Security**:
  - Security headers middleware adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
  - CORS disables `allow_credentials` if wildcard `*` is present; explicit origins should always be configured.
  - Frontend API interceptors clear local auth state and redirect to `/login` on `401` responses.

---

## Environment Configuration

Configure `backend/.env` from `backend/.env.example`:

- `SECRET_KEY` *(required)*: Strong random secret for signing JWTs (e.g., `openssl rand -hex 32` or `python -c "import secrets; print(secrets.token_urlsafe(32))"`). Never commit `.env` or real secrets.
- `FRONTEND_URLS`: Comma-separated list of allowed frontend origins for CORS (use explicit origins; never `*` when credentials are enabled).
- `DATABASE_URL` *(optional)*: Defaults to `sqlite:///./campusfix.db`. For PostgreSQL, set `postgres://...` or `postgresql://...` (automatically normalized to `postgresql+pg8000://...`).

Configure `frontend/.env` from `frontend/.env.example` (optional `VITE_CAMPUS_LAT`, `VITE_CAMPUS_LNG`, and API base URL if overriding defaults).

---

## Local Setup & Database Migrations

### 1. Backend Setup (`backend/`)
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env and set a strong SECRET_KEY
```

Run Alembic migrations (required on PostgreSQL to add the `invalid` value to the `complaintstatus` enum, as well as to initialize/upgrade tables):
```bash
python -m alembic upgrade head
```

Start the API server:
```bash
uvicorn main:app --reload
```
Swagger UI is available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup (`frontend/`)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
The frontend dev server runs at `http://localhost:5173`.

### 3. Demo Users (Optional)
From `backend/` with your virtual environment active:
```bash
python create_demo_users.py
```
Creates demo accounts for `student@campusfix.edu`, `staff@campusfix.edu`, and `admin@campusfix.edu` (password: `password123`).

---

## Verification Commands

### Backend Tests
```bash
cd backend
python -m pytest -q
```

### Frontend Lint & Production Build
```bash
cd frontend
npm run lint
npm run build
```
