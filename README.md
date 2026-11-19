# CampusFix - College Complaint Management System

CampusFix is a modern, responsive, and easy-to-use web application designed as a college mini-project to help students report and track campus-related issues. It streamlines the workflow between Students, Admins, and Staff members.

## 🚀 Tech Stack
- **Frontend**: React, Vite, Tailwind CSS v4, React Router
- **Backend**: FastAPI (Python), SQLAlchemy (ORM), Alembic
- **Database**: SQLite (Development)
- **Authentication**: JWT (JSON Web Tokens)

---

## 🌟 Features
- **Role-Based Access Control**: Secure dashboards isolated for Student, Admin, and Staff roles.
- **Complaint Lifecycle**: Track complaints through `Submitted` ➔ `Assigned` ➔ `In Progress` ➔ `Resolved` ➔ `Closed`.
- **Admin Assignment**: Admins can oversee all campus issues and assign them to specific staff members.
- **Staff Workflow**: Staff can view their assigned tasks, start work, and leave resolution notes.
- **Student Feedback**: Students can close resolved tickets and leave feedback/ratings.
- **Responsive Design**: Works flawlessly on Desktop, Tablet, and Mobile devices.

---

## 🛠️ Prerequisites
Make sure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)

---

## ⚙️ Setup Instructions

### 1. Backend Setup (FastAPI)
Open a terminal and navigate to the `backend` folder:
```bash
cd backend
```

Create a virtual environment and activate it:
```bash
python -m venv venv

# On Windows:
venv\Scripts\activate

# On Mac/Linux:
source venv/bin/activate
```

Install the dependencies:
```bash
pip install -r requirements.txt
```

Set up the environment variables by creating a `.env` file from the example:
```bash
# Copy the example config
cp .env.example .env
```
*Note: Ensure you open `.env` and configure `SECRET_KEY` with a securely generated string.*

Run database migrations to create the SQLite tables:
```bash
alembic upgrade head
```

Run the backend server:
```bash
uvicorn main:app --reload
```
The backend API will run at `http://127.0.0.1:8000`. You can view the automatic Swagger UI docs at `http://127.0.0.1:8000/docs`.

---

### 2. Frontend Setup (React)
Open a **new** terminal window and navigate to the `frontend` folder:
```bash
cd frontend
```

Install the Node.js dependencies:
```bash
npm install
```

Set up the environment variables by creating a `.env` file from the example:
```bash
# Copy the example config
cp .env.example .env
```

Start the development server:
```bash
npm run dev
```
The frontend will run at `http://localhost:5173`.

---

## 👥 Demo Users Setup
To easily test the application, you can automatically create demo users for all three roles.

Make sure your backend virtual environment is activated, then run the seeder script from the `backend` folder:
```bash
python create_demo_users.py
```

This will create the following accounts:
- **Student**: `student@campusfix.edu` / `password123`
- **Staff**: `staff@campusfix.edu` / `password123`
- **Admin**: `admin@campusfix.edu` / `password123`

---

## 🧪 Running Tests (Optional)
To run the automated backend tests, navigate to the `backend` folder and run:
```bash
pytest tests/
```

## 📝 Demo Flow (Viva/Presentation Guide)
1. Log in as the **Student** (`student@campusfix.edu`). Create a new complaint (e.g., "Fan not working in Lab 2").
2. Log out and log in as the **Admin** (`admin@campusfix.edu`). View the new complaint and assign it to the Demo Staff.
3. Log out and log in as the **Staff** (`staff@campusfix.edu`). View assigned complaints, click "Start Working", provide a resolution note, and mark it as "Resolved".
4. Log back in as the **Student** to verify the timeline, read the resolution note, and close the complaint.
