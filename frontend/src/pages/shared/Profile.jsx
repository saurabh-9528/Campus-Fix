import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complaintApi } from '../../api/complaints';
import { staffApi } from '../../api/staff';
import { adminApi } from '../../api/admin';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Input } from '../../components/ui/Input';
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  CircleCheck,
  Clock,
  Edit3,
  FileText,
  IdCard,
  Key,
  ListFilter,
  Mail,
  PlusCircle,
  Save,
  Shield,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';

const ROLE_SCOPE_NOTE = {
  admin: 'Full administrative access across complaints, staff assignments, student accounts, and analytics.',
  staff: 'Your profile details, Employee ID, department, and access are managed by CampusFix Admin.',
  student: 'Your account details, Student ID, and access are managed by CampusFix Admin.',
};

export const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [complaints, setComplaints] = useState(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  // Password Change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  useEffect(() => {
    let active = true;
    const fetchComplaints = async () => {
      try {
        let data = null;
        if (user?.role === 'student') {
          data = await complaintApi.getMyComplaints();
        } else if (user?.role === 'staff') {
          data = await staffApi.getAssignedComplaints();
        } else if (user?.role === 'admin') {
          data = await adminApi.getAdminComplaints();
        }
        if (active) {
          setComplaints(data);
        }
      } catch (err) {
        console.error('Failed to load complaints for stats', err);
      }
    };

    if (user) {
      fetchComplaints();
    }
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size={32} />
      </div>
    );
  }

  const startEditing = () => {
    setEditName(user.full_name || '');
    setUpdateError('');
    setUpdateSuccess('');
    setIsEditing(true);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdateError('');
    setUpdateSuccess('');

    const trimmed = editName.trim();
    if (!trimmed) {
      setUpdateError('Full name cannot be empty.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({ full_name: trimmed });
      setUpdateSuccess('Profile updated successfully.');
      setIsEditing(false);
    } catch (err) {
      setUpdateError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (passwords.new_password !== passwords.confirm_password) {
      setPassError('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPassSuccess('Password updated successfully.');
      setIsChangingPassword(false);
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPassError(
        err.message || 'Failed to change password. Please check your current password.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const totalComplaints = complaints?.length || 0;
  const activeComplaints =
    complaints?.filter((c) => ['submitted', 'assigned', 'in_progress'].includes(c.status))
      .length || 0;
  const resolvedComplaints =
    complaints?.filter((c) => ['resolved', 'closed'].includes(c.status)).length || 0;

  let memberSince = '—';
  if (user.created_at) {
    const date = new Date(user.created_at);
    if (!Number.isNaN(date.getTime())) {
      memberSince = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  }

  const initials = user.full_name
    ? user.full_name
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U';

  const roleDisplay = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
  const roleUpper = (user.role || 'user').toUpperCase();
  const isActive = user.is_active !== false;
  const canEditProfile = user.role === 'admin';
  const canChangePassword = user.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Profile</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-emerald-700 uppercase">
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleUpper}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Signed-in {roleDisplay} Account · Manage your profile details and security.
          </p>
        </div>

        <Link to={`/${user.role}/dashboard`} className="shrink-0">
          <Button variant="secondary" size="sm" className="h-9 px-3 text-xs font-medium">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left Column: Identity Summary & Quick Actions */}
        <div className="space-y-5">
          <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="h-16 bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-slate-100" />
            <CardContent className="-mt-9 px-6 pb-6 pt-0">
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-18 w-18 items-center justify-center rounded-full border-4 border-white bg-emerald-600 text-xl font-bold text-white shadow-sm">
                  {initials}
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  {user.full_name || roleDisplay}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">{user.email}</p>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-emerald-700 uppercase">
                    {roleUpper}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      isActive
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActive ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="mt-4 w-full rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 text-xs leading-5 text-slate-600">
                  {ROLE_SCOPE_NOTE[user.role] ||
                    'Profile information is managed by your CampusFix account.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <CardContent className="p-5">
              <h3 className="mb-3.5 flex items-center text-sm font-semibold text-gray-900">
                <Activity className="mr-2 h-4 w-4 text-emerald-600" />
                Quick Actions
              </h3>
              <div className="space-y-2.5">
                <Link to={`/${user.role}/complaints`} className="block">
                  <Button variant="secondary" size="sm" className="h-9 w-full justify-start">
                    <ListFilter className="mr-2 h-4 w-4" />
                    {user.role === 'student' ? 'My Complaints' : 'View Complaints'}
                  </Button>
                </Link>
                {user.role === 'student' && (
                  <Link to="/student/complaints/new" className="block">
                    <Button variant="primary" size="sm" className="h-9 w-full justify-start">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      + Report an Issue
                    </Button>
                  </Link>
                )}
                {canChangePassword && (
                  <Button
                    type="button"
                    onClick={() => {
                      setPassError('');
                      setIsChangingPassword((prev) => !prev);
                    }}
                    variant="secondary"
                    size="sm"
                    className="h-9 w-full justify-start"
                  >
                    <Key className="mr-2 h-4 w-4" />
                    {isChangingPassword ? 'Hide Password Form' : 'Change Password'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Account Details, Password & Activity */}
        <div className="space-y-5 lg:col-span-2">
          {updateSuccess && (
            <Alert
              type="success"
              message={updateSuccess}
              onClose={() => setUpdateSuccess('')}
            />
          )}
          {passSuccess && (
            <Alert type="success" message={passSuccess} onClose={() => setPassSuccess('')} />
          )}

          {/* Account Information */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <CardContent className="p-6">
              <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Account Details</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {canEditProfile
                      ? 'Personal identity and governance metadata for your signed-in account.'
                      : user.role === 'staff'
                        ? 'Profile details, Employee ID, department, and access are managed by CampusFix Admin.'
                        : 'Your account details, Student ID, and access are managed by CampusFix Admin.'}
                  </p>
                </div>
                {canEditProfile && !isEditing && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={startEditing}
                    className="h-8 shrink-0 px-3 text-xs font-medium"
                  >
                    <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                    Edit Profile
                  </Button>
                )}
              </div>

              {updateError && <Alert type="error" message={updateError} className="mb-4" />}

              {!(canEditProfile && isEditing) ? (
                <dl className="divide-y divide-slate-100">
                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                      <User className="h-4 w-4 text-emerald-600" />
                      Full Name
                    </dt>
                    <dd className="text-sm font-semibold text-gray-900">
                      {user.full_name || 'N/A'}
                    </dd>
                  </div>

                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Mail className="h-4 w-4 text-emerald-600" />
                      Email Address
                    </dt>
                    <dd className="text-left sm:text-right">
                      <span className="block text-sm font-semibold text-gray-900">
                        {user.email || 'N/A'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Email address is managed by your institution and cannot be changed.
                      </span>
                    </dd>
                  </div>

                  {(user.role === 'student' || user.student_id) && (
                    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <IdCard className="h-4 w-4 text-emerald-600" />
                        Student ID
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {user.student_id ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800">
                            {user.student_id}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-400">Not assigned</span>
                        )}
                      </dd>
                    </div>
                  )}

                  {(user.role === 'staff' || user.employee_id) && (
                    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <IdCard className="h-4 w-4 text-emerald-600" />
                        Employee ID
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {user.employee_id ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800">
                            {user.employee_id}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-400">Not assigned</span>
                        )}
                      </dd>
                    </div>
                  )}

                  {(user.department || user.role === 'student' || user.role === 'staff') && (
                    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <Building2 className="h-4 w-4 text-emerald-600" />
                        Department
                      </dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {user.department || (
                          <span className="text-xs font-medium text-gray-400">Not assigned</span>
                        )}
                      </dd>
                    </div>
                  )}

                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Role
                    </dt>
                    <dd>
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 uppercase">
                        {roleUpper}
                      </span>
                    </dd>
                  </div>

                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Shield className="h-4 w-4 text-emerald-600" />
                      Account Status
                    </dt>
                    <dd>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </dd>
                  </div>

                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      Member Since
                    </dt>
                    <dd className="text-sm font-semibold text-gray-900">{memberSince}</dd>
                  </div>
                </dl>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <Input
                    label="Full Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    autoFocus
                  />
                  <div className="opacity-70">
                    <Input
                      label="Email Address (read-only)"
                      value={user.email || ''}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={savingProfile}
                      onClick={() => {
                        setIsEditing(false);
                        setUpdateError('');
                        setEditName(user.full_name || '');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" disabled={savingProfile}>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Password Change Panel */}
          {canChangePassword && isChangingPassword && (
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <CardContent className="p-6">
                <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Change Password</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Update the password for your signed-in account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Close password form"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {passError && <Alert type="error" message={passError} className="mb-4" />}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <Input
                    type="password"
                    label="Current Password"
                    required
                    value={passwords.current_password}
                    onChange={(e) =>
                      setPasswords({ ...passwords, current_password: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      type="password"
                      label="New Password"
                      required
                      value={passwords.new_password}
                      onChange={(e) =>
                        setPasswords({ ...passwords, new_password: e.target.value })
                      }
                    />
                    <Input
                      type="password"
                      label="Confirm New Password"
                      required
                      value={passwords.confirm_password}
                      onChange={(e) =>
                        setPasswords({ ...passwords, confirm_password: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={savingPassword}
                      onClick={() => setIsChangingPassword(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" disabled={savingPassword}>
                      {savingPassword ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Complaint Overview */}
          {complaints && (
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <CardContent className="p-6">
                <h3 className="mb-4 border-b border-slate-100 pb-3 text-base font-semibold text-gray-900">
                  {user.role === 'admin' ? 'System Overview' : 'Complaint Overview'}
                </h3>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Total Complaints</span>
                      <FileText className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{totalComplaints}</p>
                  </div>

                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-amber-900">
                        Active Complaints
                      </span>
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-amber-950">{activeComplaints}</p>
                  </div>

                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-emerald-900">
                        Resolved Complaints
                      </span>
                      <CircleCheck className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-emerald-950">
                      {resolvedComplaints}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
