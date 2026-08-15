import React, { useEffect, useRef, useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from './dashboardTheme';
import { getNotifications } from '../../api/notificationsApi';

/** onMenuClick - opens the mobile sidebar drawer */
const DashboardTopbar = ({ onMenuClick = () => {} }) => {
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const notificationRef = useRef(null);

  /* ============================================================
     LOAD NOTIFICATIONS
  ============================================================ */
  const loadNotifications = async () => {
    setLoadingNotifications(true);

    try {
      const res = await getNotifications({
        per_page: 5,
      });

      const data = res.data || {};

      /*
       * Menyesuaikan beberapa kemungkinan bentuk response API:
       *
       * {
       *   data: [...]
       * }
       *
       * atau
       *
       * {
       *   notifications: [...]
       * }
       */
      const notificationData =
        data.data ||
        data.notifications ||
        [];

      setNotifications(
        Array.isArray(notificationData)
          ? notificationData
          : []
      );

      setUnreadCount(data.unread_count ?? 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  /* ============================================================
     LOAD INITIAL UNREAD COUNT
  ============================================================ */
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const res = await getNotifications({
          per_page: 1,
          unread: true,
        });

        setUnreadCount(
          res.data?.unread_count ?? 0
        );
      } catch (error) {
        console.error(
          'Failed to load unread notifications:',
          error
        );
      }
    };

    loadUnreadCount();
  }, []);

  /* ============================================================
     LOAD NOTIFICATIONS WHEN DROPDOWN OPENS
  ============================================================ */
  useEffect(() => {
    if (showNotifications) {
      loadNotifications();
    }
  }, [showNotifications]);

  /* ============================================================
     CLOSE DROPDOWN WHEN CLICKING OUTSIDE
  ============================================================ */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener(
        'mousedown',
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, [showNotifications]);

  /* ============================================================
     FORMAT NOTIFICATION TIME
  ============================================================ */
  const formatTime = (date) => {
    if (!date) return '';

    const notificationDate = new Date(date);
    const now = new Date();

    const diff =
      Math.floor(
        (now - notificationDate) / 1000
      );

    if (diff < 60) {
      return 'Just now';
    }

    if (diff < 3600) {
      return `${Math.floor(diff / 60)} min ago`;
    }

    if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`;
    }

    if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`;
    }

    return notificationDate.toLocaleDateString(
      'en-US',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  /* ============================================================
     GET NOTIFICATION TITLE
  ============================================================ */
  const getNotificationTitle = (notification) => {
    return (
      notification.title ||
      notification.subject ||
      notification.type ||
      'Notification'
    );
  };

  /* ============================================================
     GET NOTIFICATION MESSAGE
  ============================================================ */
  const getNotificationMessage = (notification) => {
    return (
      notification.message ||
      notification.body ||
      notification.description ||
      'You have a new notification.'
    );
  };

  /* ============================================================
     CHECK READ STATUS
  ============================================================ */
  const isUnread = (notification) => {
    return (
      notification.is_read === false ||
      notification.read === false ||
      notification.read_at === null ||
      notification.status === 'unread'
    );
  };

  /* ============================================================
     OPEN NOTIFICATION PAGE
  ============================================================ */
  const handleViewAll = () => {
    setShowNotifications(false);
    navigate('/app/notifications');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-white border-b border-slate-100">
      
      {/* ========================================================
          LEFT SIDE
      ========================================================= */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="
            lg:hidden
            w-9 h-9
            rounded-lg
            border border-slate-200
            flex items-center justify-center
            text-slate-500
          "
        >
          <Menu size={18} />
        </button>

        {/* Search */}
        <div className="hidden md:flex items-center flex-1 max-w-md px-3.5 py-2 rounded-lg border border-slate-200 text-slate-400">
          <Search size={16} />

          <input
            type="text"
            placeholder="Search trips, trucks, drivers…"
            className="
              flex-1
              bg-transparent
              border-none
              outline-none
              text-sm
              text-slate-700
              placeholder:text-slate-400
              px-2
            "
          />

          <kbd className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* ========================================================
          RIGHT SIDE
      ========================================================= */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">

        {/* ======================================================
            NOTIFICATION
        ======================================================= */}
        <div
          ref={notificationRef}
          className="relative"
        >
          <button
            onClick={() =>
              setShowNotifications(
                (prev) => !prev
              )
            }
            className={`
              relative
              w-9 h-9
              rounded-full
              border
              flex
              items-center
              justify-center
              transition
              ${
                showNotifications
                  ? 'border-slate-300 bg-slate-50 text-slate-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }
            `}
            aria-label="Notifications"
          >
            <Bell size={16} />

            {/* Unread indicator */}
            {unreadCount > 0 && (
              <span
                className="
                  absolute
                  -top-0.5
                  -right-0.5
                  min-w-[16px]
                  h-4
                  px-1
                  rounded-full
                  text-[9px]
                  font-bold
                  text-white
                  flex
                  items-center
                  justify-center
                "
                style={{
                  backgroundColor: COLORS.teal,
                }}
              >
                {unreadCount > 99
                  ? '99+'
                  : unreadCount}
              </span>
            )}
          </button>

          {/* ====================================================
              NOTIFICATION DROPDOWN
          ===================================================== */}
          {showNotifications && (
            <div
              className="
                absolute
                right-0
                top-12
                z-[100]
                w-[360px]
                max-w-[calc(100vw-2rem)]
                bg-white
                rounded-xl
                border
                border-slate-200
                shadow-xl
                overflow-hidden
              "
            >

              {/* Dropdown Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Notifications
                  </h3>

                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {unreadCount > 0
                      ? `${unreadCount} unread notification${
                          unreadCount > 1
                            ? 's'
                            : ''
                        }`
                      : 'You are all caught up'}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <button
                    className="
                      flex
                      items-center
                      gap-1
                      text-[11px]
                      font-medium
                      text-slate-500
                      hover:text-slate-700
                    "
                    onClick={() => {
                      /*
                       * Nanti bisa dihubungkan
                       * ke API mark-all-as-read.
                       */
                      console.log(
                        'Mark all as read'
                      );
                    }}
                  >
                    <CheckCheck size={14} />
                    Mark all
                  </button>
                )}
              </div>

              {/* Dropdown Content */}
              <div className="max-h-[360px] overflow-y-auto">

                {/* Loading */}
                {loadingNotifications && (
                  <div className="px-4 py-8 text-center">
                    <div
                      className="
                        w-6 h-6
                        mx-auto
                        border-2
                        border-slate-200
                        border-t-slate-500
                        rounded-full
                        animate-spin
                      "
                    />

                    <p className="text-xs text-slate-400 mt-3">
                      Loading notifications...
                    </p>
                  </div>
                )}

                {/* Empty */}
                {!loadingNotifications &&
                  notifications.length === 0 && (
                    <div className="px-4 py-10 text-center">
                      <div
                        className="
                          w-10 h-10
                          mx-auto
                          rounded-full
                          bg-slate-50
                          flex
                          items-center
                          justify-center
                        "
                      >
                        <Bell
                          size={18}
                          className="text-slate-400"
                        />
                      </div>

                      <p className="text-sm font-medium text-slate-600 mt-3">
                        No notifications
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        You're all caught up!
                      </p>
                    </div>
                  )}

                {/* Notification List */}
                {!loadingNotifications &&
                  notifications.length > 0 &&
                  notifications.map(
                    (notification, index) => {
                      const unread =
                        isUnread(notification);

                      return (
                        <button
                          key={
                            notification.id ??
                            index
                          }
                          className={`
                            w-full
                            text-left
                            px-4
                            py-3
                            border-b
                            border-slate-100
                            transition
                            hover:bg-slate-50
                            ${
                              unread
                                ? 'bg-blue-50/30'
                                : 'bg-white'
                            }
                          `}
                          onClick={() => {
                            /*
                             * Jika notification mempunyai
                             * URL / link, bisa diarahkan
                             * ke sana.
                             */
                            if (
                              notification.url
                            ) {
                              navigate(
                                notification.url
                              );

                              setShowNotifications(
                                false
                              );
                            }
                          }}
                        >
                          <div className="flex gap-3">

                            {/* Unread dot */}
                            <div className="pt-1.5">
                              <span
                                className={`
                                  block
                                  w-2
                                  h-2
                                  rounded-full
                                  ${
                                    unread
                                      ? ''
                                      : 'opacity-0'
                                  }
                                `}
                                style={{
                                  backgroundColor:
                                    COLORS.teal,
                                }}
                              />
                            </div>

                            {/* Notification content */}
                            <div className="flex-1 min-w-0">

                              <p
                                className={`
                                  text-xs
                                  ${
                                    unread
                                      ? 'font-semibold text-slate-800'
                                      : 'font-medium text-slate-600'
                                  }
                                `}
                              >
                                {getNotificationTitle(
                                  notification
                                )}
                              </p>

                              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                                {getNotificationMessage(
                                  notification
                                )}
                              </p>

                              <p className="text-[10px] text-slate-400 mt-1.5">
                                {formatTime(
                                  notification.created_at ||
                                    notification.createdAt
                                )}
                              </p>

                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
              </div>

              {/* ==================================================
                  VIEW ALL
              =================================================== */}
              <div className="border-t border-slate-100">
                <button
                  onClick={handleViewAll}
                  className="
                    w-full
                    flex
                    items-center
                    justify-center
                    gap-1.5
                    px-4
                    py-3
                    text-xs
                    font-medium
                    text-slate-600
                    hover:bg-slate-50
                    transition
                  "
                >
                  View all notifications
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>
          )}
        </div>

        {/* ======================================================
            USER PROFILE
        ======================================================= */}
        <div className="flex items-center gap-2">
          
          <div
            className="
              w-9 h-9
              rounded-full
              flex
              items-center
              justify-center
              text-white
              text-xs
              font-semibold
              shrink-0
            "
            style={{
              background: `linear-gradient(
                135deg,
                ${COLORS.teal},
                ${COLORS.aqua}
              )`,
            }}
          >
            RP
          </div>

          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-semibold text-slate-800">
              Rangga Putra
            </p>

            <p className="text-xs text-slate-400">
              Admin · Company A
            </p>
          </div>

          <ChevronDown
            size={14}
            className="hidden sm:block text-slate-400"
          />
        </div>
      </div>
    </header>
  );
};

export default DashboardTopbar;