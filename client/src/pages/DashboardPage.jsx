import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Package,
  Repeat,
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Clock,
  Play,
  CheckCircle,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Calendar,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState({ text: '', type: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard');
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRunBilling = async () => {
    setActionLoading(true);
    setActionMessage({ text: '', type: '' });
    try {
      const res = await api.post('/automation/billing-run', {});
      setActionMessage({ text: res.message || 'Billing job executed successfully!', type: 'success' });
      fetchMetrics();
    } catch (err) {
      setActionMessage({ text: err.message || 'Billing run failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunOverdueCheck = async () => {
    setActionLoading(true);
    setActionMessage({ text: '', type: '' });
    try {
      const res = await api.post('/automation/overdue-check', {});
      setActionMessage({ text: res.message || 'Overdue check completed!', type: 'success' });
      fetchMetrics();
    } catch (err) {
      setActionMessage({ text: err.message || 'Overdue check failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const expiringSubs = data?.expiringSubscriptions || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {user?.role === 'customer' ? `Welcome, ${user?.companyName || user?.full_name}` : 'Subscription & Financial Analytics'}
          </h1>
          <p className="text-sm text-slate-500">
            {user?.role === 'customer'
              ? 'Manage your subscriptions, view upcoming renewals, and download payment receipts.'
              : 'Real-time financial metrics, recurring cashflow, and billing automation.'}
          </p>
        </div>

        {user?.role === 'admin' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunBilling}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {actionLoading ? 'Executing...' : 'Run Billing Now'}
            </button>

            <button
              onClick={handleRunOverdueCheck}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
            >
              <Clock className="w-3.5 h-3.5" />
              Check Overdue
            </button>

            <button
              onClick={fetchMetrics}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              title="Refresh Analytics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {actionMessage.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${actionMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {actionMessage.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* CUSTOMER RENEWAL REMINDER BANNER (7 DAYS HORIZON) */}
      {user?.role === 'customer' && expiringSubs.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5 animate-pulse">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                Renewal Alert: {expiringSubs.length} Subscription(s) Expiring Soon!
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {expiringSubs.map(s => `${s.subscription_number} (${s.plan_name}) scheduled to renew/expire on ${s.expiry_date}`).join('; ')}.
                Renew online via Razorpay to avoid service disruption.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/subscriptions')}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shrink-0 shadow-sm"
          >
            <CreditCard className="w-4 h-4" />
            <span>Renew via Razorpay</span>
          </button>
        </div>
      )}

      {/* CUSTOMER BROWSE PLANS CTA */}
      {user?.role === 'customer' && (
        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" /> Discover All Company Subscription Plans
            </h3>
            <p className="text-xs text-blue-100 mt-1">
              Need extra seats, higher tiers, or add-on product variants? Check our plans and activate in 60 seconds via Razorpay.
            </p>
          </div>
          <button
            onClick={() => navigate('/plans')}
            className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl transition shrink-0 shadow-xs flex items-center justify-center gap-2"
          >
            <span>Explore Plans Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {user?.role === 'customer' ? 'My Monthly Total' : 'Monthly Recurring (MRR)'}
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(kpis.mrr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            ARR: ₹{Number(kpis.arr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Subscriptions</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {kpis.activeSubscriptions || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total on file: {kpis.totalSubscriptions || 0}
          </div>
        </div>

        {/* Payments Received */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Payments Made</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600">
            ₹{Number(kpis.totalPaymentsReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Paid invoices: {kpis.paidInvoices || 0}
          </div>
        </div>

        {/* Outstanding / Overdue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Balance</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            ₹{Number(kpis.outstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-rose-500 font-medium mt-1 flex items-center gap-1">
            {kpis.overdueInvoices || 0} overdue invoice(s)
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {user?.role === 'customer' ? 'My Invoiced vs Paid History' : 'Billed vs Collected Revenue'}
              </h2>
              <p className="text-xs text-slate-500">6-Month financial billing trend</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              ₹ INR
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.monthlyRevenue || []}>
                <defs>
                  <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0c87eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0c87eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val.toLocaleString()}`} />
                <Tooltip
                  formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="billed" name="Billed" stroke="#0c87eb" fillOpacity={1} fill="url(#billedGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" fillOpacity={1} fill="url(#collectedGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Status Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Invoice Payment Breakdown</h2>
            <p className="text-xs text-slate-500 mb-4">Paid, pending & overdue invoice shares</p>

            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.paymentStatusDistribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(charts.paymentStatusDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Value']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
            {(charts.paymentStatusDistribution || []).map((st) => (
              <div key={st.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }}></span>
                <span className="truncate">{st.name}: {st.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-Column Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Popularity Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Subscribers by Plan</h2>
              <p className="text-xs text-slate-500">Distribution across active tiers</p>
            </div>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={charts.planDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} width={100} />
                <Tooltip formatter={(val) => [`${val} subscribers`, 'Subscribers']} />
                <Bar dataKey="subscribers" fill="#0c87eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expiring Subscriptions & Actionable Alerts */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Subscriptions Expiring Soon (Next 7 Days)</h2>
              <p className="text-xs text-slate-500">Requires renewal confirmation or automated reminder</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
              {data?.expiringSubscriptions?.length || 0} Noticeable
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Subscription #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3 text-right">Value</th>
                  {user?.role === 'customer' && <th className="py-2.5 px-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.expiringSubscriptions || []).length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'customer' ? 6 : 5} className="py-6 text-center text-slate-400">
                      No subscriptions expiring within the next 7 days.
                    </td>
                  </tr>
                ) : (
                  data?.expiringSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-semibold text-blue-600">{sub.subscription_number}</td>
                      <td className="py-3 px-3 font-medium text-slate-800">{sub.company_name}</td>
                      <td className="py-3 px-3 text-slate-600">{sub.plan_name}</td>
                      <td className="py-3 px-3 font-semibold text-amber-600">{sub.expiry_date}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">
                        ₹{Number(sub.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      {user?.role === 'customer' && (
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => navigate('/subscriptions')}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] rounded-lg transition"
                          >
                            Renew
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
