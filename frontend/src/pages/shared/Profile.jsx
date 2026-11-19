import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complaintApi } from '../../api/complaints';
import { staffApi } from '../../api/staff';
import { adminApi } from '../../api/admin';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Input } from '../../components/ui/Input';
import { 
  User, Mail, Shield, Calendar, Activity, 
  FileText, CircleCheck, Clock, PlusCircle, 
  ListFilter, Edit3, Key, Save, X
} from 'lucide-react';

export const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [complaints, setComplaints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  // Password Change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        let data = null;
        if (user?.role === 'student') {
          data = await complaintApi.getMyComplaints();
        } else if (user?.role === 'staff') {
          data = await staffApi.getComplaints(); // assuming gets all assigned to them
        } else if (user?.role === 'admin') {
          data = await adminApi.getComplaints(); // gets all complaints
        }
        setComplaints(data);
      } catch (err) {
        // It's okay if fetching complaints fails, we still want to show the profile
        console.error('Failed to load complaints for stats', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchComplaints();
      setEditName(user.full_name || '');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size={32} />
      </div>
    );
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdateError('');
    setUpdateSuccess('');
    try {
      if (!editName.trim()) {
        setUpdateError('Name cannot be empty.');
        return;
      }
      await updateProfile({ full_name: editName });
      setUpdateSuccess('Profile updated successfully.');
      setIsEditing(false);
    } catch (err) {
      setUpdateError(err.message || 'Failed to update profile.');
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
    
    try {
      await changePassword({ 
        current_password: passwords.current_password,
        new_password: passwords.new_password
      });
      setPassSuccess('Password updated successfully.');
      setIsChangingPassword(false);
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPassError(err.message || 'Failed to change password. Please check your current password.');
    }
  };

  // Calculate stats
  const totalComplaints = complaints?.length || 0;
  const activeComplaints = complaints?.filter(c => ['submitted', 'assigned', 'in_progress'].includes(c.status)).length || 0;
  const resolvedComplaints = complaints?.filter(c => ['resolved', 'closed'].includes(c.status)).length || 0;

  let memberSince = "Member since —";
  if (user.created_at) {
    const date = new Date(user.created_at);
    if (!isNaN(date.getTime())) {
      memberSince = `Member since ${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
    }
  }

  const initials = user.full_name 
    ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const roleDisplay = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6 px-4 sm:px-6">
      <div className="pb-2">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Profile</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Manage your CampusFix account and view your activity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Identity & Actions */}
        <div className="space-y-6">
          <Card className="rounded-[1.5rem] border border-emerald-100 shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-24 bg-emerald-50"></div>
            <CardContent className="p-6 relative pt-12">
              <div className="flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-white rounded-full p-1.5 shadow-sm border border-emerald-100 mb-4 z-10">
                  <div className="h-full w-full bg-emerald-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {initials}
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{user.full_name || roleDisplay}</h2>
                <div className="mt-2 mb-2">
                  <Badge variant="primary" className="uppercase tracking-wider px-3">{user.role}</Badge>
                </div>
                <p className="text-sm font-medium text-gray-500">CampusFix {roleDisplay} Account</p>
                <p className="text-xs font-semibold text-gray-400 mt-4 px-4 py-2 bg-gray-50 rounded-lg w-full border border-gray-100">
                  Profile information is managed by your campus account.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-[1.5rem] border border-gray-100 shadow-sm bg-white">
            <CardContent className="p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-emerald-500" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                {user.role === 'student' && (
                  <Link to="/student/complaints/new" className="block">
                    <Button variant="primary" className="w-full justify-start rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm">
                      <PlusCircle className="mr-3 h-4 w-4" />
                      Report an Issue
                    </Button>
                  </Link>
                )}
                <Link to={`/${user.role}/complaints`} className="block">
                  <Button variant="secondary" className="w-full justify-start rounded-xl h-11 bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700 shadow-sm font-bold">
                    <ListFilter className="mr-3 h-4 w-4" />
                    View Complaints
                  </Button>
                </Link>
                <Button 
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                  variant="secondary" 
                  className="w-full justify-start rounded-xl h-11 bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700 shadow-sm font-bold"
                >
                  <Key className="mr-3 h-4 w-4" />
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Info & Stats */}
        <div className="lg:col-span-2 space-y-6">
          
          {updateSuccess && <Alert type="success" message={updateSuccess} onClose={() => setUpdateSuccess('')} />}
          {passSuccess && <Alert type="success" message={passSuccess} onClose={() => setPassSuccess('')} />}

          {/* Password Change Panel */}
          {isChangingPassword && (
            <Card className="rounded-[1.5rem] border border-gray-100 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex justify-between items-center border-b border-gray-50 mb-6 pb-4">
                  <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
                  <Button variant="ghost" size="sm" onClick={() => setIsChangingPassword(false)} className="text-gray-500">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {passError && <Alert type="error" message={passError} className="mb-4" />}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <Input 
                    type="password"
                    label="Current Password" 
                    required 
                    value={passwords.current_password}
                    onChange={(e) => setPasswords({...passwords, current_password: e.target.value})}
                  />
                  <Input 
                    type="password"
                    label="New Password" 
                    required 
                    value={passwords.new_password}
                    onChange={(e) => setPasswords({...passwords, new_password: e.target.value})}
                  />
                  <Input 
                    type="password"
                    label="Confirm New Password" 
                    required 
                    value={passwords.confirm_password}
                    onChange={(e) => setPasswords({...passwords, confirm_password: e.target.value})}
                  />
                  <div className="pt-2 flex justify-end">
                    <Button type="button" variant="secondary" className="mr-2" onClick={() => setIsChangingPassword(false)}>Cancel</Button>
                    <Button type="submit" variant="primary">Update Password</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Account Information */}
          <Card className="rounded-[1.5rem] border border-gray-100 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-center border-b border-gray-50 mb-6 pb-4">
                <h3 className="text-lg font-bold text-gray-900">Account Information</h3>
                {!isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-emerald-600 hover:text-emerald-700">
                    <Edit3 className="h-4 w-4 mr-2" /> Edit Profile
                  </Button>
                )}
              </div>
              
              {updateError && <Alert type="error" message={updateError} className="mb-4" />}

              {!isEditing ? (
                <div className="space-y-5">
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mr-4 shrink-0 border border-emerald-100">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name</p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">{user.full_name || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mr-4 shrink-0 border border-emerald-100">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email Address</p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">{user.email || 'N/A'}</p>
                      <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mr-4 shrink-0 border border-emerald-100">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Account Status</p>
                      <div className="mt-1">
                        {user.is_active !== false ? (
                          <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
                        ) : (
                          <Badge variant="error">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mr-4 shrink-0 border border-emerald-100">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Member Since</p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">{memberSince}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <Input 
                    label="Full Name" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                  <div className="opacity-60">
                    <Input 
                      label="Email Address" 
                      value={user.email}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="secondary" onClick={() => { setIsEditing(false); setEditName(user.full_name || ''); }}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      <Save className="h-4 w-4 mr-2" /> Save Changes
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Complaint Overview */}
          {complaints && (
            <Card className="rounded-[1.5rem] border border-gray-100 shadow-sm bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 pb-4 border-b border-gray-50">
                  {user.role === 'admin' ? 'System Overview' : 'Complaint Overview'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Total */}
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex flex-col items-center sm:items-start text-center sm:text-left transition-transform hover:-translate-y-0.5">
                    <div className="h-12 w-12 rounded-xl bg-white text-emerald-600 flex items-center justify-center shadow-sm mb-3">
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="text-3xl font-extrabold text-emerald-900">{totalComplaints}</p>
                    <p className="text-sm font-bold text-emerald-700 mt-1">Total Complaints</p>
                  </div>
                  
                  {/* Active */}
                  <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex flex-col items-center sm:items-start text-center sm:text-left transition-transform hover:-translate-y-0.5">
                    <div className="h-12 w-12 rounded-xl bg-white text-orange-600 flex items-center justify-center shadow-sm mb-3">
                      <Clock className="h-6 w-6" />
                    </div>
                    <p className="text-3xl font-extrabold text-orange-900">{activeComplaints}</p>
                    <p className="text-sm font-bold text-orange-700 mt-1">Active Complaints</p>
                  </div>
                  
                  {/* Resolved */}
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex flex-col items-center sm:items-start text-center sm:text-left transition-transform hover:-translate-y-0.5">
                    <div className="h-12 w-12 rounded-xl bg-white text-emerald-600 flex items-center justify-center shadow-sm mb-3">
                      <CircleCheck className="h-6 w-6" />
                    </div>
                    <p className="text-3xl font-extrabold text-emerald-900">{resolvedComplaints}</p>
                    <p className="text-sm font-bold text-emerald-700 mt-1">Resolved Complaints</p>
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
