import React from 'react';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { NotificationDropdown } from './NotificationDropdown';

export const TopBar = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 z-10 sticky top-0">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 -ml-2 mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-800 hidden sm:block tracking-tight">
          {user?.role === 'student' && 'Student Portal'}
          {user?.role === 'staff' && 'Staff Portal'}
          {user?.role === 'admin' && 'Admin Portal'}
        </h1>
      </div>

      <div className="flex items-center space-x-6">
        {user && (
          <>
            <NotificationDropdown />
            
            <div className="flex items-center space-x-3 border-l border-gray-100 pl-4 sm:pl-6">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-bold text-gray-800">{user.full_name}</span>
                <span className="text-[10px] font-semibold text-primary-600 uppercase tracking-widest mt-0.5">
                  {user.role}
                </span>
              </div>
              
              <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-bold uppercase ring-2 ring-primary-100 shadow-sm">
                {user.full_name?.charAt(0)}
              </div>

              <button
                onClick={logout}
                className="p-2 ml-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-xl transition-all"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
