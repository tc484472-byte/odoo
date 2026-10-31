import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Repeat,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  Package,
  Layers,
  Percent,
  Users,
  Building,
  Cpu,
  Sparkles
} from 'lucide-react';

export function Sidebar() {
  const { user } = useAuth();
  const role = user?.role || 'customer';

  const navItemClass = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        {/* Core Operations / Portal Navigation */}
        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            {role === 'customer' ? 'Customer Portal' : 'Operations'}
          </p>
          <nav className="space-y-1">
            <NavLink to="/" end className={navItemClass}>
              <LayoutDashboard className="w-4 h-4" />
              <span>{role === 'customer' ? 'My Overview' : 'Dashboard'}</span>
            </NavLink>

            {/* Customers can explore all available subscription plans */}
            {role === 'customer' && (
              <NavLink to="/plans" className={navItemClass}>
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Explore Plans</span>
              </NavLink>
            )}

            <NavLink to="/subscriptions" className={navItemClass}>
              <Repeat className="w-4 h-4" />
              <span>{role === 'customer' ? 'My Subscriptions' : 'Subscriptions'}</span>
            </NavLink>

            {role !== 'customer' && (
              <NavLink to="/quotations" className={navItemClass}>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Quotations</span>
              </NavLink>
            )}

            <NavLink to="/invoices" className={navItemClass}>
              <Receipt className="w-4 h-4" />
              <span>{role === 'customer' ? 'My Invoices' : 'Invoices'}</span>
            </NavLink>

            <NavLink to="/payments" className={navItemClass}>
              <CreditCard className="w-4 h-4" />
              <span>{role === 'customer' ? 'Payment History' : 'Payments'}</span>
            </NavLink>
          </nav>
        </div>

        {/* Configuration / Catalog for Admin & Staff */}
        {role !== 'customer' && (
          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Catalog & Setup
            </p>
            <nav className="space-y-1">
              <NavLink to="/products" className={navItemClass}>
                <Package className="w-4 h-4" />
                <span>Products & Variants</span>
              </NavLink>

              <NavLink to="/plans" className={navItemClass}>
                <Layers className="w-4 h-4" />
                <span>Subscription Plans</span>
              </NavLink>

              {role === 'admin' && (
                <NavLink to="/discounts-taxes" className={navItemClass}>
                  <Percent className="w-4 h-4" />
                  <span>Discounts & Taxes</span>
                </NavLink>
              )}

              <NavLink to="/customers" className={navItemClass}>
                <Building className="w-4 h-4" />
                <span>Customers</span>
              </NavLink>
            </nav>
          </div>
        )}

        {/* System & Team Provisioning for Admin */}
        {role === 'admin' && (
          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Administration
            </p>
            <nav className="space-y-1">
              <NavLink to="/staff" className={navItemClass}>
                <Users className="w-4 h-4" />
                <span>Staff & Admins</span>
              </NavLink>

              <NavLink to="/automation" className={navItemClass}>
                <Cpu className="w-4 h-4" />
                <span>Automation Hub</span>
              </NavLink>
            </nav>
          </div>
        )}
      </div>

      {/* Role Badge Footer */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
        <span className="text-slate-500 font-medium">Logged in as</span>
        <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
          role === 'admin' ? 'bg-purple-100 text-purple-700' :
          role === 'staff' ? 'bg-blue-100 text-blue-700' :
          'bg-emerald-100 text-emerald-700'
        }`}>
          {role}
        </span>
      </div>
    </aside>
  );
}
