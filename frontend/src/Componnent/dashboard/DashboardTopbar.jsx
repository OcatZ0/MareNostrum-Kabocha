import React, { useEffect, useRef, useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  CheckCheck,
  ArrowRight,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { COLORS } from './dashboardTheme';
import { getNotifications, markAllAsRead } from '../../api/notificationsApi';
import axiosClient from '../../axios';
import { useStateContext } from '../../Contexts/Context';

const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
};

/** onMenuClick - opens the mobile sidebar drawer */
const DashboardTopbar = ({
  onMenuClick = () => {},
  unreadCountProp = null,
}) => {
  const navigate = useNavigate();
  const { currentUser, setToken, setCurrentUser } = useStateContext();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(unreadCountProp ?? 0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  // Sync unreadCount from parent prop if provided
  useEffect(() => {
    if (unreadCountProp !== null && unreadCountProp !== undefined) {
      setUnreadCount(unreadCountProp);
    }
  }, [unreadCountProp]);

  /* ============================================================
     LOAD CURRENT USER (Fallback from cached Cookies / LocalStorage if not in context)
  ============================================================ */
  useEffect(() => {
    if (!currentUser) {
      try {
        const rawUser = Cookies.get('currentUser');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          setCurrentUser(parsed);
        } else {
          const localName = localStorage.getItem('user_name');
          if (localName) {
            setCurrentUser({ name: localName, role: 'admin' });
          }
        }
      } catch {
        // ignore JSON parse error
      }
    }
  }, [currentUser, setCurrentUser]);

  /* ============================================================
     LOAD NOTIFICATIONS (Only when user opens dropdown)
  ============================================================ */
  const loadNotifications = async () => {
    setLoadingNotifications(true);

    try {
      const res = await getNotifications({
        per_page: 5,
      });

      const data = res.data || {};
      const notificationData = data.data || data.notifications || [];

      setNotifications(Array.isArray(notificationData) ? notificationData : []);
      setUnreadCount(data.unread_count ?? 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  /* ============================================================
     LOAD NOTIFICATIONS WHEN DROPDOWN OPENS
  ============================================================ */
  useEffect(() => {
    if (showNotifications) {
      loadNotifications();
    }
  }, [showNotifications]);

  /* ============================================================
     MARK ALL AS READ
  ============================================================ */
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  /* ============================================================
     CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
  ============================================================ */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /* ============================================================
     HANDLE SEARCH
  ============================================================ */
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      navigate(`/app/trips?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  /* ============================================================
     HANDLE LOGOUT
  ============================================================ */
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await axiosClient.post('/api/logout');
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setToken(null);
      setCurrentUser(null);
      Cookies.remove('accessToken');
      Cookies.remove('currentUser');
      localStorage.removeItem('user_name');
      navigate('/login', { replace: true });
    }
  };

  /* ============================================================
     FORMAT NOTIFICATION TIME
  ============================================================ */
  const formatTime = (date) => {
    if (!date) return '';

    const notificationDate = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - notificationDate) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;

    return notificationDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getNotificationTitle = (notification) => {
    return notification.title || notification.subject || notification.type || 'Notification';
  };

  const getNotificationMessage = (notification) => {
    return (
      notification.message ||
      notification.body ||
      notification.description ||
      'You have a new notification.'
    );
  };

  const isUnread = (notification) => {
    return (
      notification.is_read === false ||
      notification.read === false ||
      notification.read_at === null ||
      notification.status === 'unread'
    );
  };

  const handleViewAll = () => {
    setShowNotifications(false);
    navigate('/app/notifications');
  };

  // User display info
  const userName = currentUser?.name || 'Administrator';
  const userRole = (currentUser?.role || 'admin').toUpperCase();
  const userCompany = currentUser?.company_name || 'Mare Nostrum';
  const userInitials = initials(userName);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-white border-b-2 border-slate-200">
      
      {/* LEFT SIDE: Hamburger & Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-lg border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition"
          aria-label="Open navigation drawer"
        >
          <Menu size={18} />
        </button>

        {/* Search Input */}
        <div className="hidden md:flex items-center flex-1 max-w-md px-3.5 py-2 rounded-lg border-2 border-slate-200 text-slate-400 focus-within:border-slate-400 focus-within:text-slate-600 transition">
          <Search size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search trips, trucks, drivers (Press Enter)…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400 px-2"
          />
          <kbd className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
            ↵
          </kbd>
        </div>
      </div>

      {/* RIGHT SIDE: Notifications & Profile */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">

        {/* NOTIFICATIONS */}
        <div ref={notificationRef} className="relative">
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className={`
              relative w-9 h-9 rounded-full border-2 flex items-center justify-center transition
              ${
                showNotifications
                  ? 'border-slate-400 bg-slate-50 text-slate-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }
            `}
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: COLORS.teal }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* NOTIFICATION DROPDOWN */}
          {showNotifications && (
            <div className="absolute right-0 top-12 z-[100] w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-xl border-2 border-slate-200 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {unreadCount > 0
                      ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                      : 'You are all caught up'}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <button
                    className="flex items-center gap-1 text-[11px] font-medium text-teal-600 hover:text-teal-800 transition"
                    onClick={handleMarkAllAsRead}
                  >
                    <CheckCheck size={14} />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {loadingNotifications && (
                  <div className="px-4 py-8 text-center">
                    <div className="w-6 h-6 mx-auto border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 mt-3">Loading notifications...</p>
                  </div>
                )}

                {!loadingNotifications && notifications.length === 0 && (
                  <div className="px-4 py-10 text-center">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-50 flex items-center justify-center">
                      <Bell size={18} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mt-3">No notifications</p>
                    <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
                  </div>
                )}

                {!loadingNotifications &&
                  notifications.length > 0 &&
                  notifications.map((notification, index) => {
                    const unread = isUnread(notification);
                    return (
                      <button
                        key={notification.id ?? index}
                        className={`w-full text-left px-4 py-3 border-b border-slate-100 transition hover:bg-slate-50 ${
                          unread ? 'bg-blue-50/30' : 'bg-white'
                        }`}
                        onClick={() => {
                          if (notification.url) {
                            navigate(notification.url);
                            setShowNotifications(false);
                          }
                        }}
                      >
                        <div className="flex gap-3">
                          <div className="pt-1.5">
                            <span
                              className={`block w-2 h-2 rounded-full ${unread ? '' : 'opacity-0'}`}
                              style={{ backgroundColor: COLORS.teal }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs ${unread ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                              {getNotificationTitle(notification)}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                              {getNotificationMessage(notification)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1.5">
                              {formatTime(notification.created_at || notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              <div className="border-t border-slate-100">
                <button
                  onClick={handleViewAll}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  View all notifications
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* USER PROFILE & MENU */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.aqua})`,
              }}
            >
              {userInitials}
            </div>

            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-semibold text-slate-800 truncate max-w-[140px]">
                {userName}
              </p>
              <p className="text-xs text-slate-400 truncate max-w-[140px]">
                {userRole} · {userCompany}
              </p>
            </div>

            <ChevronDown
              size={14}
              className={`hidden sm:block text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {/* User Menu Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 top-12 z-[100] w-56 bg-white rounded-xl border-2 border-slate-200 shadow-xl overflow-hidden py-1">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <p className="text-xs font-bold text-slate-800">{userName}</p>
                {currentUser?.username && (
                  <p className="text-[11px] text-slate-400">@{currentUser.username}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                  <Shield size={12} className="text-teal-600" />
                  <span>{userRole} Role</span>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/app/dashboard');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition text-left"
                >
                  <User size={14} className="text-slate-400" />
                  Dashboard Overview
                </button>
              </div>

              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 transition text-left font-medium disabled:opacity-60"
                >
                  <LogOut size={14} className="text-red-500" />
                  {loggingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default DashboardTopbar;