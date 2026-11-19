import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../api/notifications';
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck,
  FilePlus, 
  UserCheck, 
  LoaderCircle, 
  CircleCheck,
  X
} from 'lucide-react';
import { Spinner } from '../ui/Spinner';

export const NotificationDropdown = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  // Poll for unread count
  useEffect(() => {
    if (!user) return;
    
    const fetchCount = async () => {
      try {
        const res = await notificationApi.getUnreadCount();
        setUnreadCount(res.count);
      } catch (err) {
        console.error("Failed to fetch notification count", err);
      }
    };
    
    fetchCount();
    
    // Poll every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationApi.getNotifications(20);
      setNotifications(data);
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation(); // prevent clicking the notification body
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const handleNotificationClick = async (notif) => {
    // 1. Mark as read if unread
    if (!notif.is_read) {
      try {
        await notificationApi.markAsRead(notif.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }
    
    setIsOpen(false);
    
    // 2. Navigate based on role and complaint_id
    if (notif.complaint_id) {
      if (user.role === 'student') navigate(`/student/complaints/${notif.complaint_id}`);
      else if (user.role === 'staff') navigate(`/staff/complaints/${notif.complaint_id}`);
      else if (user.role === 'admin') navigate(`/admin/complaints/${notif.complaint_id}`);
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'complaint_submitted': return <FilePlus className="h-5 w-5 text-emerald-600" />;
      case 'complaint_assigned': return <UserCheck className="h-5 w-5 text-indigo-600" />;
      case 'complaint_in_progress': return <LoaderCircle className="h-5 w-5 text-orange-600" />;
      case 'complaint_resolved': return <CircleCheck className="h-5 w-5 text-teal-600" />;
      case 'complaint_closed': return <CheckCheck className="h-5 w-5 text-gray-600" />;
      default: return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };
  
  const getIconBg = (type) => {
    switch(type) {
      case 'complaint_submitted': return 'bg-emerald-100';
      case 'complaint_assigned': return 'bg-indigo-100';
      case 'complaint_in_progress': return 'bg-orange-100';
      case 'complaint_resolved': return 'bg-teal-100';
      case 'complaint_closed': return 'bg-gray-100';
      default: return 'bg-gray-100';
    }
  };

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr + "Z"); // Append Z to enforce UTC parsing since DB returns UTC
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button 
        onClick={handleToggle}
        className={`p-2 rounded-xl transition-colors relative flex items-center justify-center
          ${isOpen ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-emerald-600 hover:bg-gray-50'}
        `}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col max-h-[85vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-3">
                <Spinner size={24} />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <p className="text-sm font-medium text-red-600 mb-2">{error}</p>
                <button 
                  onClick={fetchNotifications}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3">
                  <BellOff className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-gray-900 mb-1">No notifications yet</p>
                <p className="text-xs text-gray-500">You'll see updates about your campus complaints here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 flex gap-3 cursor-pointer transition-colors relative
                      ${notif.is_read ? 'hover:bg-gray-50/80 bg-white' : 'hover:bg-emerald-50/80 bg-emerald-50/30'}
                    `}
                  >
                    {!notif.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r"></div>
                    )}
                    
                    <div className={`mt-0.5 h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${getIconBg(notif.type)}`}>
                      {getIcon(notif.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-6">
                      <p className={`text-sm ${notif.is_read ? 'font-semibold text-gray-800' : 'font-bold text-gray-900'}`}>
                        {notif.title}
                      </p>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${notif.is_read ? 'text-gray-500' : 'text-gray-600'}`}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] font-semibold text-gray-400 mt-1.5 uppercase tracking-wider">
                        {formatTimeAgo(notif.created_at)}
                      </p>
                    </div>

                    {!notif.is_read && (
                      <button
                        onClick={(e) => handleMarkAsRead(e, notif.id)}
                        className="absolute right-4 top-4 h-6 w-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
