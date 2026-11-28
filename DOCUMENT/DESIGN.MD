# CampusFix — Design System & UI/UX Specification

**Status:** Reflects Actual Codebase Implementation  
**Source of Truth:** `frontend/src/index.css`, `frontend/index.html`, `frontend/src/components/**`, `frontend/src/pages/**`  
**Last Verified:** 2026-11-28

> **Note:** No external Figma or approved visual design spec exists in the repository. All tokens, layouts, and component behaviors documented below are derived directly from the implemented frontend code.

---

## 1. Product Design Philosophy

CampusFix uses a clean, high-clarity, utility-first SaaS dashboard aesthetic built with **Tailwind CSS v4** (`@import "tailwindcss";`) and **Lucide React** icons. The interface prioritizes:
- **Role Isolation:** Distinct portal titles (`Student Portal`, `Staff Portal`, `Admin Portal`) and role-scoped sidebar navigation (`Sidebar.jsx`).
- **Low-Friction Triage:** Scannable status and priority badges, summary KPI cards, and clear inline action panels.
- **Responsive Parity:** Desktop data tables paired with mobile card views for complaint lists and dashboards.

---

## 2. Design System: Color & Typography

### 2.1 Typography (`frontend/index.html`, `frontend/src/index.css`)
- **Font Family:** `'Inter', sans-serif` (`--font-sans`), loaded via Google Fonts (`400`, `500`, `600`, `700`).
- **Hierarchy (Observed Usage):**
  - Page Titles (`h1`): `text-2xl font-bold text-gray-900`
  - Section Headings (`h2`): `text-lg font-semibold text-gray-900`
  - TopBar Portal Title: `text-lg font-bold text-gray-800 tracking-tight`
  - Table Headers / Micro-labels: `text-xs font-medium text-gray-500 uppercase tracking-wider`
  - Body Copy: `text-sm text-gray-600` / `text-gray-700`

### 2.2 Color Tokens (`frontend/src/index.css` `@theme`)
- **Primary Palette (Emerald Green):**
  - `--color-primary-50: #ecfdf5`
  - `--color-primary-100: #d1fae5`
  - `--color-primary-200: #a7f3d0`
  - `--color-primary-300: #6ee7b7`
  - `--color-primary-400: #34d399`
  - `--color-primary-500: #10b981`
  - `--color-primary-600: #059669` (Brand wordmark, primary actions)
  - `--color-primary-700: #047857`
  - `--color-primary-900: #064e3b`
- **Semantic Colors:**
  - `--color-success: #10b981` (Green)
  - `--color-warning: #fb923c` (Soft Orange)
  - `--color-danger: #ef4444` (Red)
  - `--color-neutral: #64748b` (Slate)
  - `--color-progress: #a78bfa` (Lavender/Purple)
- **Canvas & Surfaces:**
  - `--color-cream-50: #faf9f6` (`body` background)
  - `AppLayout.jsx` shell uses `bg-gray-50` with `bg-white` cards/sidebar and `bg-white/80 backdrop-blur-md` sticky `TopBar`.

### 2.3 Status & Priority Badges (`StatusBadge.jsx`, `PriorityBadge.jsx`)
| Component | Value | Variant | Display Label |
| :--- | :--- | :--- | :--- |
| `StatusBadge` | `submitted` | `warning` | Submitted |
| `StatusBadge` | `assigned` | `warning` | Assigned |
| `StatusBadge` | `in_progress` | `progress` | In Progress |
| `StatusBadge` | `resolved` | `success` | Resolved |
| `StatusBadge` | `closed` | `neutral` | Closed |
| `PriorityBadge` | `low` | `neutral` | Low |
| `PriorityBadge` | `medium` | `primary` | Medium |
| `PriorityBadge` | `high` | `warning` | High |
| `PriorityBadge` | `critical` | `danger` | Critical |

---

## 3. Layout & Navigation Structure

- **Shell (`AppLayout.jsx`):** Full-height flex layout (`h-screen overflow-hidden`) with fixed-width `w-64` `Sidebar` on `lg:`+ screens (slide-over drawer with `bg-gray-900/50` overlay on mobile), sticky `h-16` `TopBar`, and scrollable `<main>` (`max-w-7xl mx-auto p-4 sm:p-6 lg:p-8`).
- **TopBar (`TopBar.jsx`):** Mobile hamburger toggle, portal title, `NotificationDropdown` (bell with unread badge, 60s poll), user avatar initial, name/role pill, and logout button.
- **Navigation Links (`Sidebar.jsx`):**
  - **Student:** Dashboard, My Complaints, New Complaint, Profile + bottom CTA card ("Report an Issue").
  - **Staff:** Dashboard, Assigned Complaints, Profile.
  - **Admin:** Dashboard, All Complaints, Manage Staff, Profile.
- **Standalone Auth Views (No AppLayout):** `/login` (`Login.jsx`) and `/staff/change-password` (`ChangePassword.jsx`).

---

## 4. Role-Specific Interface Requirements

- **Student Interface (`frontend/src/pages/student/`):**
  - `Dashboard.jsx`: Complaint summary and recent tickets.
  - `NewComplaint.jsx`: Structured form (title, description, category, location, priority, optional image upload).
  - `ComplaintList.jsx` & `ComplaintDetails.jsx`: Status/category/priority filtering, attachment preview (`ComplaintAttachment.jsx`), activity timeline (`ActivityTimeline.jsx`), and feedback submission form (1–5 rating + comment) when `resolved`.
- **Staff Interface (`frontend/src/pages/staff/`):**
  - `ChangePassword.jsx`: Mandatory first-login password rotation card with temporary password, new password (>= 8 chars), confirm password, and Sign Out button.
  - `Dashboard.jsx`, `ComplaintList.jsx`, `ComplaintDetails.jsx`: Assigned complaint queue, "Start Working" (`in_progress`) and "Resolve" (`resolved` + required resolution note) workflow.
- **Admin Interface (`frontend/src/pages/admin/`):**
  - `Dashboard.jsx`: 4 KPI cards (`Total`, `Pending`, `In Progress`, `Resolved/Closed`), average feedback rating pill, Recent Complaints table/cards, Category Overview progress bars, and Staff Workload table.
  - `ComplaintList.jsx` & `ComplaintDetails.jsx`: Full complaint list + 2-column detail view with Staff Assignment card, Priority Management card (disabled when `resolved`/`closed`), Student Information card, and Activity History timeline.
  - `StaffList.jsx`: 3-column responsive card grid (`md:grid-cols-2 lg:grid-cols-3`) showing staff avatar initial, name, email, `employee_id`, `department`, `Active` / `Pending Activation` pill, and **Activate** button for pending staff.

---

## 5. Responsive Design & Accessibility

- **Responsive Patterns (`IMPLEMENTED`):**
  - Mobile slide-out sidebar (`-translate-x-full` -> `translate-x-0` on `lg:static`).
  - Dual table/card rendering (`hidden md:block` table + `md:hidden` stacked cards in `AdminDashboard`).
  - Responsive grids (`grid-cols-2 md:grid-cols-4`, `grid-cols-1 lg:grid-cols-3`).
- **Accessibility (`PARTIALLY IMPLEMENTED` / `NEEDS VERIFICATION`):**
  - Focus-visible rings on inputs/selects (`focus-visible:ring-2 focus-visible:ring-primary-500`) and Escape/click-outside handling on `NotificationDropdown`.
  - Gaps: Several icon-only buttons (e.g., mobile menu button in `TopBar.jsx`, bell button in `NotificationDropdown.jsx`) lack `aria-label` attributes; full WCAG 2.1 AA keyboard/contrast audit has not been performed.

---

## 6. Forms, Tables, Dashboards & Feedback States

- **Loading State:** Centered `<Spinner size={32} />` (or `size={24}` in dropdowns).
- **Error & Success States:** `<Alert type="error" | "success" />` banners; dismissible alerts on `StaffList.jsx`.
- **Empty States:** Dashed border `<Card className="bg-gray-50 border-dashed">` with muted Lucide icon, title, and helper copy.

---

## 7. Future Design Improvements (`PLANNED` / `NOT IMPLEMENTED`)

- Add `aria-label` and `aria-expanded` attributes across icon buttons, dropdowns, and mobile drawer toggles.
- Add search input and pagination controls to complaint tables.
- Unify page background (`AppLayout.jsx` uses `bg-gray-50` while `index.css` sets `body` to `--color-cream-50`).
- Remove unused legacy `frontend/src/pages/auth/Register.jsx` file if public registration remains permanently disabled.
