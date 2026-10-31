import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import {
  Repeat,
  Search,
  Filter,
  Plus,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  Eye,
  Calendar,
  Building,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export function SubscriptionsPage() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & View States
  const [selectedSub, setSelectedSub] = useState(null);
  const [subDetails, setSubDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionAlert, setActionAlert] = useState({ text: '', type: '' });

  // Creation form state
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [newSub, setNewSub] = useState({
    customerId: '',
    planId: '',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    billingFrequency: 'monthly',
    quantity: 1,
    paymentTerms: 'Net 15'
  });

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscriptions');
      if (res.success) {
        setSubscriptions(res.subscriptions);
        setFiltered(res.subscriptions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuxData = async () => {
    if (user?.role === 'customer') return;
    try {
      const [custRes, planRes] = await Promise.all([
        api.get('/customers'),
        api.get('/plans')
      ]);
      if (custRes.success) setCustomers(custRes.customers);
      if (planRes.success) setPlans(planRes.plans);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    loadAuxData();
  }, []);

  // Filter & Search handler
  useEffect(() => {
    let list = [...subscriptions];
    if (activeTab !== 'all') {
      list = list.filter(s => s.status.toLowerCase() === activeTab);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(s =>
        s.subscription_number.toLowerCase().includes(term) ||
        (s.company_name && s.company_name.toLowerCase().includes(term)) ||
        (s.plan_name && s.plan_name.toLowerCase().includes(term))
      );
    }
    setFiltered(list);
  }, [activeTab, searchTerm, subscriptions]);

  // View Subscription Details
  const handleViewDetails = async (sub) => {
    setSelectedSub(sub);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/subscriptions/${sub.id}`);
      if (res.success) {
        setSubDetails(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Lifecycle Action (Pause, Resume, Renew, Close)
  const handleLifecycleAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this subscription?`)) return;

    try {
      const res = await api.post(`/subscriptions/${id}/status`, { action });
      if (res.success) {
        setActionAlert({ text: res.message, type: 'success' });
        fetchSubscriptions();
        if (selectedSub?.id === id) {
          handleViewDetails(res.subscription);
        }
      }
    } catch (err) {
      setActionAlert({ text: err.message || `Failed to ${action} subscription`, type: 'error' });
    }
  };

  // Create Subscription
  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/subscriptions', newSub);
      if (res.success) {
        setIsCreateOpen(false);
        setActionAlert({ text: `Subscription ${res.subscription.subscription_number} created successfully!`, type: 'success' });
        fetchSubscriptions();
      }
    } catch (err) {
      alert(err.message || 'Failed to create subscription');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
      case 'paused':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Paused</span>;
      case 'closed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">Closed</span>;
      case 'expired':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">Expired</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 capitalize">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Repeat className="w-5 h-5 text-blue-600" />
            {user?.role === 'customer' ? 'My Subscriptions' : 'Subscription Lifecycle Management'}
          </h1>
          <p className="text-sm text-slate-500">
            {user?.role === 'customer'
              ? 'View your active software services, renewal dates, and billing periods.'
              : 'Track recurring subscriptions, validate transitions, pause, renew, or close accounts.'}
          </p>
        </div>

        {user?.role !== 'customer' && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Subscription
          </button>
        )}
      </div>

      {actionAlert.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${actionAlert.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {actionAlert.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{actionAlert.text}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0">
          {['all', 'active', 'paused', 'closed', 'expired'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search subscription, customer..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Subscription #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Plan Name</th>
                <th className="py-3 px-4">Billing Frequency</th>
                <th className="py-3 px-4">Next Billing Date</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading subscriptions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No subscriptions found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {sub.subscription_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {sub.company_name}
                      <span className="block text-[11px] text-slate-400 font-normal">{sub.customer_email}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {sub.plan_name}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-600">
                      {sub.billing_frequency}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {sub.next_billing_date}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ₹{Number(sub.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(sub.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetails(sub)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Lifecycle controls for staff/admin */}
                        {user?.role !== 'customer' && (
                          <>
                            {sub.status === 'active' && (
                              <button
                                onClick={() => handleLifecycleAction(sub.id, 'pause')}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                title="Pause Subscription"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            )}

                            {sub.status === 'paused' && (
                              <button
                                onClick={() => handleLifecycleAction(sub.id, 'resume')}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Resume Subscription"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            )}

                            {(sub.status === 'active' || sub.status === 'expired') && (
                              <button
                                onClick={() => handleLifecycleAction(sub.id, 'renew')}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Renew Subscription"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}

                            {sub.status !== 'closed' && (
                              <button
                                onClick={() => handleLifecycleAction(sub.id, 'close')}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Close / Cancel Subscription"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Details Modal */}
      <Modal
        isOpen={!!selectedSub}
        onClose={() => { setSelectedSub(null); setSubDetails(null); }}
        title={`Subscription Details: ${selectedSub?.subscription_number}`}
        maxWidth="max-w-3xl"
      >
        {detailsLoading || !subDetails ? (
          <div className="py-8 text-center text-slate-400">Loading details...</div>
        ) : (
          <div className="space-y-6">
            {/* Meta summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">Customer</span>
                <span className="font-bold text-slate-800">{subDetails.subscription.company_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Plan</span>
                <span className="font-bold text-slate-800">{subDetails.subscription.plan_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Billing Frequency</span>
                <span className="font-bold capitalize text-slate-800">{subDetails.subscription.billing_frequency}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status</span>
                <span>{getStatusBadge(subDetails.subscription.status)}</span>
              </div>
            </div>

            {/* Line items table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Subscription Products & Add-ons</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5">Qty</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subDetails.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">
                          {subDetails.subscription.plan_name} Recurring Package
                        </td>
                      </tr>
                    ) : (
                      subDetails.items.map((it) => (
                        <tr key={it.id}>
                          <td className="p-2.5 font-medium text-slate-800">
                            {it.description}
                            {it.attribute_value && <span className="block text-[10px] text-blue-600">Variant: {it.attribute_value}</span>}
                          </td>
                          <td className="p-2.5 text-slate-600">{it.quantity}</td>
                          <td className="p-2.5 text-right text-slate-600">₹{Number(it.unit_price).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">₹{Number(it.total_price).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoices History Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Generated Billing Invoices</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Billing Period</th>
                      <th className="p-2.5 text-right">Amount</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subDetails.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          No invoices generated yet.
                        </td>
                      </tr>
                    ) : (
                      subDetails.invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="p-2.5 font-bold text-blue-600">{inv.invoice_number}</td>
                          <td className="p-2.5 text-slate-600">{inv.invoice_date}</td>
                          <td className="p-2.5 text-slate-600">{inv.billing_period_start} to {inv.billing_period_end}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">₹{Number(inv.total_amount).toFixed(2)}</td>
                          <td className="p-2.5 capitalize font-semibold">{inv.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* New Subscription Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Subscription"
      >
        <form onSubmit={handleCreateSubscription} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Customer *</label>
            <select
              required
              value={newSub.customerId}
              onChange={(e) => setNewSub({ ...newSub, customerId: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name} ({c.contact_name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Subscription Plan *</label>
            <select
              required
              value={newSub.planId}
              onChange={(e) => {
                const selected = plans.find(p => String(p.id) === e.target.value);
                setNewSub({
                  ...newSub,
                  planId: e.target.value,
                  billingFrequency: selected ? selected.billing_frequency : 'monthly'
                });
              }}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose Plan --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} - ₹{p.price} / {p.billing_frequency}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={newSub.startDate}
                onChange={(e) => setNewSub({ ...newSub, startDate: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Frequency</label>
              <select
                value={newSub.billingFrequency}
                onChange={(e) => setNewSub({ ...newSub, billingFrequency: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs capitalize focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={newSub.quantity}
                onChange={(e) => setNewSub({ ...newSub, quantity: Math.max(1, parseInt(e.target.value, 10)) })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
              <input
                type="text"
                value={newSub.paymentTerms}
                onChange={(e) => setNewSub({ ...newSub, paymentTerms: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
          >
            Create Subscription
          </button>
        </form>
      </Modal>
    </div>
  );
}
