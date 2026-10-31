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
  AlertCircle,
  CreditCard,
  Lock,
  Smartphone,
  QrCode,
  Building2,
  CheckCircle2,
  Clock
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

  // Razorpay Renewal Modal State
  const [renewSub, setRenewSub] = useState(null);
  const [renewPaymentTab, setRenewPaymentTab] = useState('upi');
  const [renewProcessing, setRenewProcessing] = useState(false);
  const [renewSuccess, setRenewSuccess] = useState(null);

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

  // Lifecycle Action (Pause, Resume, Close)
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

  // Open Razorpay Renewal
  const handleOpenRenew = (sub) => {
    setRenewSub(sub);
    setRenewSuccess(null);
  };

  // Process Razorpay Renewal
  const handleProcessRenewal = async () => {
    if (!renewSub) return;
    setRenewProcessing(true);

    try {
      // 1. Create renewal order
      const orderRes = await api.post('/payments/razorpay/order', {
        isRenewal: true,
        subscriptionId: renewSub.id
      });

      if (!orderRes.success || !orderRes.orderId) {
        throw new Error(orderRes.message || 'Could not initiate Razorpay renewal order');
      }

      // 2. Complete payment verification
      const verifyRes = await api.post('/payments/razorpay/verify', {
        razorpay_order_id: orderRes.orderId,
        razorpay_payment_id: `pay_renew_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        razorpay_signature: 'simulated_signature',
        isRenewal: true,
        subscriptionId: renewSub.id
      });

      if (verifyRes.success) {
        setRenewSuccess(verifyRes);
        setActionAlert({
          text: `Success! Subscription ${renewSub.subscription_number} renewed until ${verifyRes.newExpiryDate}!`,
          type: 'success'
        });
        fetchSubscriptions();
      } else {
        throw new Error(verifyRes.message || 'Renewal verification failed');
      }
    } catch (err) {
      alert(err.message || 'Renewal payment failed.');
    } finally {
      setRenewProcessing(false);
    }
  };

  // Create Subscription (Staff / Admin)
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
              ? 'View your active software services, renewal dates, and renew via Razorpay.'
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
          {['all', 'active', 'paused', 'expired', 'closed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search subscription #, plan..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
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

                        {/* Customer Renewal & Pause Controls */}
                        {user?.role === 'customer' ? (
                          <>
                            {(sub.status === 'active' || sub.status === 'expired') && (
                              <button
                                onClick={() => handleOpenRenew(sub)}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] rounded-lg transition flex items-center gap-1 border border-blue-200"
                                title="Renew via Razorpay"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Renew</span>
                              </button>
                            )}

                            {sub.status === 'active' && sub.allow_pause && (
                              <button
                                onClick={() => handleLifecycleAction(sub.id, 'pause')}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                title="Pause Subscription"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            )}

                            {sub.status === 'paused' && (
                              <button
                                onClick={() => handleLifecycleAction(sub.id, 'resume')}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Resume Subscription"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          /* Admin & Staff lifecycle controls */
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
                                onClick={() => handleOpenRenew(sub)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Renew Subscription via Razorpay"
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

      {/* RAZORPAY RENEWAL MODAL */}
      <Modal
        isOpen={!!renewSub}
        onClose={() => {
          setRenewSub(null);
          setRenewSuccess(null);
        }}
        title={`Renew Subscription: ${renewSub?.subscription_number}`}
      >
        {renewSuccess ? (
          <div className="text-center py-4 space-y-4 text-xs">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Renewal Confirmed!</h3>
              <p className="text-slate-500 mt-1">
                Your subscription has been renewed via Razorpay and invoice {renewSuccess.invoiceNumber} has been settled.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Subscription Number:</span>
                <span className="font-bold text-blue-600">{renewSuccess.subscriptionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">New Expiry Date:</span>
                <span className="font-semibold text-emerald-700">{renewSuccess.newExpiryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid Invoice:</span>
                <span className="font-semibold">{renewSuccess.invoiceNumber}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setRenewSub(null);
                setRenewSuccess(null);
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-sm">{renewSub?.plan_name}</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold capitalize text-[10px]">
                  {renewSub?.billing_frequency}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Current Expiry Date:</span>
                <span className="font-semibold text-slate-800">{renewSub?.expiry_date || 'Ongoing'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Next Billing Cycle Amount:</span>
                <span className="text-sm font-black text-slate-900">
                  ₹{Number(renewSub?.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="border border-slate-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" /> Razorpay Online Renewal
                </span>
                <span className="text-[10px] font-semibold text-slate-400">Sandbox Test Mode</span>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg text-center font-semibold text-[11px]">
                <button
                  type="button"
                  onClick={() => setRenewPaymentTab('upi')}
                  className={`py-1.5 rounded-md transition ${renewPaymentTab === 'upi' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  UPI / QR
                </button>
                <button
                  type="button"
                  onClick={() => setRenewPaymentTab('card')}
                  className={`py-1.5 rounded-md transition ${renewPaymentTab === 'card' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setRenewPaymentTab('netbanking')}
                  className={`py-1.5 rounded-md transition ${renewPaymentTab === 'netbanking' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Netbanking
                </button>
              </div>

              {renewPaymentTab === 'upi' && (
                <div className="p-2 bg-slate-50 rounded-lg space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-slate-700 font-mono text-[11px]">customer@okhdfcbank</span>
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> Quick authorize via Google Pay, PhonePe, Paytm
                  </p>
                </div>
              )}

              {renewPaymentTab === 'card' && (
                <div className="p-2 bg-slate-50 rounded-lg font-mono text-slate-700 text-[11px] space-y-1">
                  <div>Card: 4111 •••• •••• 4444 (Visa Test)</div>
                  <div className="text-[10px] text-slate-400">Valid Thru: 12/28 | CVV: •••</div>
                </div>
              )}

              {renewPaymentTab === 'netbanking' && (
                <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600">
                  <span>HDFC Bank, ICICI Bank, State Bank of India, Axis Bank</span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={renewProcessing}
              onClick={handleProcessRenewal}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {renewProcessing ? (
                <span>Renewing via Razorpay...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Pay ₹{Number(renewSub?.total_amount || 0).toFixed(2)} & Renew</span>
                </>
              )}
            </button>
          </div>
        )}
      </Modal>

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
                      <th className="p-2.5">Invoice Date</th>
                      <th className="p-2.5">Total Amount</th>
                      <th className="p-2.5">Outstanding</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subDetails.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">No invoices generated yet.</td>
                      </tr>
                    ) : (
                      subDetails.invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="p-2.5 font-bold text-blue-600">{inv.invoice_number}</td>
                          <td className="p-2.5 text-slate-600">{inv.invoice_date}</td>
                          <td className="p-2.5 font-semibold text-slate-900">₹{Number(inv.total_amount).toFixed(2)}</td>
                          <td className="p-2.5 font-semibold text-rose-600">₹{Number(inv.outstanding_amount).toFixed(2)}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              inv.status === 'overdue' ? 'bg-rose-100 text-rose-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setSelectedSub(null); setSubDetails(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE SUBSCRIPTION MODAL (STAFF / ADMIN ONLY) */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Subscription"
      >
        <form onSubmit={handleCreateSubscription} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Customer *</label>
            <select
              required
              value={newSub.customerId}
              onChange={(e) => setNewSub({ ...newSub, customerId: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-xl"
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name} ({c.contact_name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Plan *</label>
            <select
              required
              value={newSub.planId}
              onChange={(e) => {
                const p = plans.find(pl => String(pl.id) === e.target.value);
                setNewSub({
                  ...newSub,
                  planId: e.target.value,
                  billingFrequency: p ? p.billing_frequency : newSub.billingFrequency
                });
              }}
              className="w-full p-2 border border-slate-300 rounded-xl"
            >
              <option value="">-- Choose Plan --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} - ₹{Number(p.price).toFixed(2)} ({p.billing_frequency})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity (Seats) *</label>
              <input
                type="number"
                min="1"
                required
                value={newSub.quantity}
                onChange={(e) => setNewSub({ ...newSub, quantity: parseInt(e.target.value, 10) || 1 })}
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Billing Frequency</label>
              <select
                value={newSub.billingFrequency}
                onChange={(e) => setNewSub({ ...newSub, billingFrequency: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl capitalize"
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
              <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={newSub.startDate}
                onChange={(e) => setNewSub({ ...newSub, startDate: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expiry Date (Optional)</label>
              <input
                type="date"
                value={newSub.expiryDate}
                onChange={(e) => setNewSub({ ...newSub, expiryDate: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
          >
            Create & Activate Subscription
          </button>
        </form>
      </Modal>
    </div>
  );
}
