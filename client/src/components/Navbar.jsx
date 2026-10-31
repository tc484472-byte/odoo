import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, ShieldCheck, Briefcase, Zap, Bell } from 'lucide-react';

export function Navbar() {
  const { user, logout, login } = useAuth();

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
