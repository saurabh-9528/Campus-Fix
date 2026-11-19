import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  Users, 
  User,
  Megaphone
} from 'lucide-react';

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();

  if (!user) return null;

  const role = user.role;

  const studentLinks = [
    { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/complaints', label: 'My Complaints', icon: FileText },
    { to: '/student/complaints/new', label: 'New Complaint', icon: PlusCircle },
    { to: '/student/profile', label: 'Profile', icon: User },
  ];

  const staffLinks = [
    { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/staff/complaints', label: 'Assigned Complaints', icon: FileText },
    { to: '/staff/profile', label: 'Profile', icon: User },
  ];

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/complaints', label: 'All Complaints', icon: FileText },
    { to: '/admin/staff', label: 'Manage Staff', icon: Users },
    { to: '/admin/profile', label: 'Profile', icon: User },
  ];

  let links = [];
  if (role === 'student') links = studentLinks;
  else if (role === 'staff') links = staffLinks;
  else if (role === 'admin') links = adminLinks;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-gray-900/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-100 shadow-sm flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <span className="text-xl font-bold text-primary-600 tracking-tight">CampusFix</span>
        </div>
        
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary-50 text-primary-700 shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className={`mr-3 h-5 w-5 ${link.to === window.location.pathname ? 'text-primary-600' : 'text-gray-400'}`} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
        
        {role === 'student' && (
          <div className="p-4 mb-4 mx-4 bg-primary-50 rounded-2xl border border-primary-100/50 text-center">
            <div className="mx-auto bg-white shadow-sm w-10 h-10 rounded-full flex items-center justify-center mb-3">
               <Megaphone className="h-5 w-5 text-primary-600" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">Report an Issue</h4>
            <p className="text-xs text-gray-600 mt-1 mb-4 leading-relaxed">
              Help us improve your campus by reporting issues you encounter.
            </p>
            <Link 
              to="/student/complaints/new" 
              onClick={() => setIsOpen(false)} 
              className="block w-full py-2 bg-white text-primary-700 text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all hover:-translate-y-0.5"
            >
               + New Complaint
            </Link>
          </div>
        )}
      </aside>
    </>
  );
};
