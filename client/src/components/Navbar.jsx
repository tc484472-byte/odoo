import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { LogOut, Zap, Bell, Check, Clock, AlertTriangle, Receipt, CreditCard, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Navbar() {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (e) {
      // Ignore background notification fetch errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // Polling every 20s
    return () => clearInterval(interval);
  }, [user]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all', {});
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.patch(`/notifications/${notif.id}/read`, {});
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        console.error(e);
      }
    }
    setIsOpen(false);

    if (notif.type === 'renewal_reminder') {
      navigate('/subscriptions');
    } else if (notif.type === 'invoice_generated' || notif.type === 'overdue_notice') {
      navigate('/invoices');
    } else if (notif.type === 'payment_received') {
      navigate('/payments');
    }
  };

  const handleQuickSwitch = async (roleEmail) => {
    try {
      if (roleEmail === 'admin@brightloop.com') await login('admin@brightloop.com', 'Admin@12345');
      else if (roleEmail === 'staff@brightloop.com') await login('staff@brightloop.com', 'Staff@12345');
      else if (roleEmail === 'acme@corp.com') await login('acme@corp.com', 'Customer@12345');
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 shadow-xs">
      {/* Brand title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-sm">
          BL
        </div>
        <div>
          <span className="font-bold text-slate-800 text-lg leading-tight flex items-center gap-2">
            Brightloop <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 font-semibold rounded-full uppercase tracking-wider">Odoo Hackathon</span>
          </span>
          <p className="text-xs text-slate-500 hidden sm:block">Automated Subscription & Recurring Billing</p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Quick Demo Switcher (Judges convenience) */}
        <div className="hidden md:flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
          <span className="px-2 text-slate-500 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Switch:
          </span>
          <button
            onClick={() => handleQuickSwitch('admin@brightloop.com')}
            className={`px-2 py-1 rounded transition ${user?.role === 'admin' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'hover:bg-slate-200'}`}
          >
            Admin
          </button>
          <button
            onClick={() => handleQuickSwitch('staff@brightloop.com')}
            className={`px-2 py-1 rounded transition ${user?.role === 'staff' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'hover:bg-slate-200'}`}
          >
            Staff
          </button>
          <button
            onClick={() => handleQuickSwitch('acme@corp.com')}
            className={`px-2 py-1 rounded transition ${user?.role === 'customer' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'hover:bg-slate-200'}`}
          >
            Customer
          </button>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Notifications & Renewal Reminders"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-blue-600" /> Notifications & Alerts
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {unreadCount > 0 ? `${unreadCount} unread update(s)` : 'All caught up!'}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => {
                    const isRenewal = n.type === 'renewal_reminder';
                    const isOverdue = n.type === 'overdue_notice';
                    const isPayment = n.type === 'payment_received';

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3.5 hover:bg-slate-50 cursor-pointer transition flex items-start gap-3 ${
                          !n.is_read ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          isRenewal ? 'bg-amber-100 text-amber-700' :
                          isOverdue ? 'bg-rose-100 text-rose-700' :
                          isPayment ? 'bg-emerald-100 text-emerald-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {isRenewal ? <Clock className="w-4 h-4" /> :
                           isOverdue ? <AlertTriangle className="w-4 h-4" /> :
                           isPayment ? <CreditCard className="w-4 h-4" /> :
                           <Receipt className="w-4 h-4" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {n.title}
                            </span>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 ml-2"></span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed mb-1">
                            {n.message}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {isRenewal && (
                              <span className="text-blue-600 font-semibold flex items-center hover:underline">
                                Renew now <ChevronRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-slate-800 flex items-center justify-end gap-1.5">
              {user?.full_name || user?.fullName}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                user?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                user?.role === 'staff' ? 'bg-blue-100 text-blue-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {user?.role}
              </span>
            </div>
            <div className="text-xs text-slate-500 truncate max-w-[180px]">
              {user?.companyName || user?.email}
            </div>
          </div>

          <button
            onClick={logout}
            title="Log out"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
