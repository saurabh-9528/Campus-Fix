import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Key, LogOut } from 'lucide-react';

export const StaffChangePassword = () => {
  const { changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your temporary password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      navigate('/staff/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 mb-3">
            <Key className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Set Your New Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            You must change your temporary password before accessing the Staff dashboard.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && <Alert type="error" message={error} />}

              <Input
                label="Temporary Password"
                id="current_password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />

              <Input
                label="New Password"
                id="new_password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Input
                label="Confirm New Password"
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Updating Password...' : 'Update Password & Continue'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleLogout}
                disabled={isSubmitting}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
