import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';

// Student Pages
import { StudentDashboard } from './pages/student/Dashboard';
import { ComplaintList as StudentComplaintList } from './pages/student/ComplaintList';
import { NewComplaint as StudentNewComplaint } from './pages/student/NewComplaint';
import { ComplaintDetails as StudentComplaintDetails } from './pages/student/ComplaintDetails';
import { Profile } from './pages/shared/Profile';

// Admin Pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { ComplaintList as AdminComplaintList } from './pages/admin/ComplaintList';
import { ComplaintDetails as AdminComplaintDetails } from './pages/admin/ComplaintDetails';
import { StaffList as AdminStaffList } from './pages/admin/StaffList';

// Staff Pages
import { StaffDashboard } from './pages/staff/Dashboard';
import { ComplaintList as StaffComplaintList } from './pages/staff/ComplaintList';
import { ComplaintDetails as StaffComplaintDetails } from './pages/staff/ComplaintDetails';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes inside AppLayout */}
          <Route element={<AppLayout />}>
            
            {/* Student Routes */}
            <Route element={<ProtectedRoute allowedRoles={['student']} />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/complaints" element={<StudentComplaintList />} />
              <Route path="/student/complaints/new" element={<StudentNewComplaint />} />
              <Route path="/student/complaints/:id" element={<StudentComplaintDetails />} />
              <Route path="/student/profile" element={<Profile />} />
            </Route>

            {/* Staff Routes */}
            <Route element={<ProtectedRoute allowedRoles={['staff']} />}>
              <Route path="/staff/dashboard" element={<StaffDashboard />} />
              <Route path="/staff/complaints" element={<StaffComplaintList />} />
              <Route path="/staff/complaints/:id" element={<StaffComplaintDetails />} />
              <Route path="/staff/profile" element={<Profile />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/complaints" element={<AdminComplaintList />} />
              <Route path="/admin/complaints/:id" element={<AdminComplaintDetails />} />
              <Route path="/admin/staff" element={<AdminStaffList />} />
              <Route path="/admin/profile" element={<Profile />} />
            </Route>

          </Route>

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
