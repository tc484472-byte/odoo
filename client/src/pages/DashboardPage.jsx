import React, { useState, useEffect } from 'react';
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
  AlertCircle
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
      const res = await api.post('/automation/run-billing', {});
      setActionMessage({ text: res.message, type: 'success' });
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
      setActionMessage({ text: res.message, type: 'success' });
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
          <p className="text-sm font-medium text-slate-500">Loading financial dashboard...</p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

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

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Monthly Recurring (MRR)</span>
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
            <span className="text-xs font-semibold uppercase tracking-wider">Payments Received</span>
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
            {kpis.overdueInvoices || 0} overdue invoices pending
          </div>
        </div>
      </div>

      {/* Secondary KPI Row */}
      {user?.role !== 'customer' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
            <p className="text-xs text-slate-400">Total Customers</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{kpis.totalCustomers || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
            <p className="text-xs text-slate-400">Active Catalog Products</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{kpis.totalProducts || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
            <p className="text-xs text-slate-400">Paused Subscriptions</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{kpis.pausedSubscriptions || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
            <p className="text-xs text-slate-400">Expiring in 7 Days</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{kpis.expiringSoonSubscriptions || 0}</p>
          </div>
        </div>
      )}

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Monthly Revenue & Collection</h2>
              <p className="text-xs text-slate-500">Billed amount vs Collected cashflow (Last 6 Months)</p>
            </div>
            <span className="text-xs font-semibold text-blue-600 px-2.5 py-1 bg-blue-50 rounded-lg">
              Live DB Aggregates
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.monthlyRevenue || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="billed" name="Billed Amount" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorBilled)" />
                <Area type="monotone" dataKey="collected" name="Collected Amount" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Status Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Payment Status Distribution</h2>
            <p className="text-xs text-slate-500 mb-2">Current invoices by payment status</p>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.paymentStatusDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {(charts.paymentStatusDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val, name, item) => [`${val} invoices (₹${item.payload.value.toLocaleString('en-IN')})`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
            {(charts.paymentStatusDistribution || []).map((s, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }}></span>
                <span className="text-slate-600 truncate">{s.name}: {s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Distribution & Expiring Subscriptions Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800 mb-1">Subscription Plan Popularity</h2>
          <p className="text-xs text-slate-500 mb-4">Active subscribers per plan</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.planDistribution || []} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#475569' }} width={80} />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.expiringSubscriptions || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
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
