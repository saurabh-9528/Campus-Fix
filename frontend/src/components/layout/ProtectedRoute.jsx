import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FullPageSpinner } from '../ui/Spinner';

export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect user to their respective dashboard if they try to access unauthorized route
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  if (user.role === 'staff' && user.must_change_password && location.pathname !== '/staff/change-password') {
    return <Navigate to="/staff/change-password" replace />;
  }

  if (user.role === 'staff' && !user.must_change_password && location.pathname === '/staff/change-password') {
    return <Navigate to="/staff/dashboard" replace />;
  }

  return <Outlet />;
};
