import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import {
  Layers,
  Plus,
  Check,
  AlertCircle,
  CreditCard,
  Sparkles,
  ShieldCheck,
  Tag,
  CheckCircle2,
  Lock,
  QrCode,
  Smartphone,
  Building2,
  ArrowRight
} from 'lucide-react';

export function PlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  // Admin Create Plan Form
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    billingFrequency: 'monthly',
    minQuantity: 1,
    startDate: '',
    endDate: '',
    autoClose: false,
    allowPause: true,
    allowRenew: true
  });

  // Customer Checkout Modal State
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountError, setDiscountError] = useState('');
  const [paymentTab, setPaymentTab] = useState('upi'); // 'upi', 'card', 'netbanking'
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);

  // Form inputs for Razorpay simulator / test card
  const [testUpiId, setTestUpiId] = useState('customer@okhdfcbank');
  const [testCardNumber, setTestCardNumber] = useState('4111 2222 3333 4444');
  const [testCardExpiry, setTestCardExpiry] = useState('12/28');
  const [testCardCvv, setTestCardCvv] = useState('123');

  const fetchPlansAndProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/plans');
      if (res.success) {
        setPlans(res.plans);
      }
      const prodRes = await api.get('/products');
      if (prodRes.success) {
        setProducts(prodRes.products || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlansAndProducts();
  }, []);

  // Collect all available variants across products
  const availableVariants = [];
  products.forEach(p => {
    if (p.variants && p.variants.length > 0) {
      p.variants.forEach(v => {
        availableVariants.push({
          ...v,
          productName: p.name
        });
      });
    }
  });

  // Calculate pricing breakdown in real time
  const calculatePricing = () => {
    if (!selectedPlan) return { subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 };

    const basePrice = Number(selectedPlan.price) || 0;
    let variantPrice = 0;
    if (selectedVariantId) {
      const v = availableVariants.find(item => String(item.id) === String(selectedVariantId));
      if (v) variantPrice = Number(v.additional_price) || 0;
    }

    const unitPrice = basePrice + variantPrice;
    const subtotal = unitPrice * Math.max(1, quantity);

    let discountAmount = 0;
    if (appliedDiscount) {
      if (appliedDiscount.discount_type === 'percentage') {
        discountAmount = Number((subtotal * (Number(appliedDiscount.discount_value) / 100)).toFixed(2));
      } else {
        discountAmount = Math.min(subtotal, Number(appliedDiscount.discount_value));
      }
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Number((taxableAmount * 0.18).toFixed(2)); // 18% GST
    const total = Number((taxableAmount + taxAmount).toFixed(2));

    return {
      basePrice,
      variantPrice,
      unitPrice,
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  };

  const pricing = calculatePricing();

  const handleApplyDiscount = async () => {
    setDiscountError('');
    if (!discountCode.trim()) return;

    try {
      const res = await api.get('/discounts');
      if (res.success) {
        const found = (res.discounts || []).find(
          d => d.code.toUpperCase() === discountCode.trim().toUpperCase() && d.is_active
        );
        if (found) {
          setAppliedDiscount(found);
          setAlertMsg({ text: `Promo code "${found.code}" applied!`, type: 'success' });
        } else {
          setDiscountError('Invalid or expired coupon code.');
        }
      }
    } catch (e) {
      setDiscountError('Could not validate coupon.');
    }
  };

  const handleOpenSubscribe = (plan) => {
    setSelectedPlan(plan);
    setQuantity(plan.min_quantity || 1);
    setSelectedVariantId('');
    setDiscountCode('WELCOME10'); // Default demo promo
    setAppliedDiscount({ code: 'WELCOME10', discount_type: 'percentage', discount_value: 10 });
    setPaymentSuccessData(null);
    setIsCheckoutOpen(true);
  };

  const handleRazorpayCheckout = async () => {
    if (!selectedPlan) return;
    setProcessingPayment(true);

    try {
      // 1. Create Razorpay Order on backend
      const orderRes = await api.post('/payments/razorpay/order', {
        planId: selectedPlan.id,
        variantId: selectedVariantId || null,
        quantity,
        discountCode: appliedDiscount ? appliedDiscount.code : null,
        isRenewal: false
      });

      if (!orderRes.success || !orderRes.orderId) {
        throw new Error(orderRes.message || 'Could not initiate Razorpay order');
      }

      // 2. Complete payment verification via Razorpay API
      const verifyRes = await api.post('/payments/razorpay/verify', {
        razorpay_order_id: orderRes.orderId,
        razorpay_payment_id: `pay_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        razorpay_signature: 'simulated_signature',
        planId: selectedPlan.id,
        variantId: selectedVariantId || null,
        quantity,
        discountCode: appliedDiscount ? appliedDiscount.code : null,
        isRenewal: false
      });

      if (verifyRes.success) {
        setPaymentSuccessData(verifyRes);
        setAlertMsg({
          text: `Success! Subscription ${verifyRes.subscriptionNumber} is now active!`,
          type: 'success'
        });
        fetchPlansAndProducts();
      } else {
        throw new Error(verifyRes.message || 'Payment verification failed');
      }
    } catch (err) {
      alert(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/plans', {
        ...form,
        price: parseFloat(form.price),
        minQuantity: parseInt(form.minQuantity, 10)
      });
      if (res.success) {
        setIsModalOpen(false);
        setAlertMsg({ text: `Plan "${res.plan.name}" created!`, type: 'success' });
        fetchPlansAndProducts();
      }
    } catch (err) {
      alert(err.message || 'Failed to create plan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            {user?.role === 'customer' ? 'Explore Subscription Plans' : 'Subscription Plans'}
          </h1>
          <p className="text-sm text-slate-500">
            {user?.role === 'customer'
              ? 'Select an enterprise plan, configure seats, and activate instantly with secure Razorpay online payment.'
              : 'Define recurring billing cycles (daily, weekly, monthly, yearly), minimum seat counts, and renewal policies.'}
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create Plan
          </button>
        )}
      </div>

      {alertMsg.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${alertMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {alertMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Customer Value Banner */}
      {user?.role === 'customer' && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-blue-900">Instant Online Activation via Razorpay</h3>
              <p className="text-[11px] text-blue-700">All subscriptions include automated renewals, GST compliant PDF invoices, and full customer self-service.</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-blue-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Razorpay Verified
          </div>
        </div>
      )}

      {/* Plans Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading subscription plans...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">No subscription plans found.</div>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {p.billing_frequency}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {p.subscriber_count || 0} active subscribers
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">{p.name}</h3>
                <p className="text-xs text-slate-500 mb-4">{p.description || 'Full-featured enterprise subscription plan.'}</p>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-black text-slate-900">
                    ₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ {p.billing_frequency}</span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex justify-between">
                    <span>Minimum Quantity:</span>
                    <span className="font-semibold text-slate-800">{p.min_quantity} seat(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Allows Pause / Resume:</span>
                    <span className="font-semibold text-emerald-600">{p.allow_pause ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Allows Renewal:</span>
                    <span className="font-semibold text-emerald-600">{p.allow_renew ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-close on expiry:</span>
                    <span className="font-semibold text-slate-700">{p.auto_close ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                {user?.role === 'customer' ? (
                  <button
                    onClick={() => handleOpenSubscribe(p)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-xs"
                  >
                    <CreditCard className="w-4 h-4" />
                    Subscribe with Razorpay
                  </button>
                ) : (
                  <div className="text-center text-xs text-slate-400">
                    Available for quotation & customer billing
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CUSTOMER RAZORPAY CHECKOUT MODAL */}
      <Modal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setPaymentSuccessData(null);
        }}
        title={paymentSuccessData ? 'Subscription Activated!' : `Subscribe to ${selectedPlan?.name || 'Plan'}`}
      >
        {paymentSuccessData ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Payment Verified via Razorpay!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your subscription has been activated and your tax invoice has been paid.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Subscription Number:</span>
                <span className="font-bold text-blue-600">{paymentSuccessData.subscriptionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid Invoice Number:</span>
                <span className="font-semibold text-slate-900">{paymentSuccessData.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Billing Cycle:</span>
                <span className="font-medium capitalize">{selectedPlan?.billing_frequency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Channel:</span>
                <span className="font-medium text-emerald-700">Razorpay Online</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setIsCheckoutOpen(false);
                  navigate('/subscriptions');
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                Go to My Subscriptions <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Plan Info Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">{selectedPlan?.name}</span>
                <p className="text-[11px] text-slate-500 capitalize">{selectedPlan?.billing_frequency} recurring billing</p>
              </div>
              <span className="text-sm font-black text-slate-900">
                ₹{Number(selectedPlan?.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Quantity / Seats */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Number of Seats / Licenses (Min: {selectedPlan?.min_quantity || 1})
              </label>
              <input
                type="number"
                min={selectedPlan?.min_quantity || 1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(selectedPlan?.min_quantity || 1, parseInt(e.target.value, 10) || 1))}
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>

            {/* Optional Variant / Brand Add-on */}
            {availableVariants.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Optional Add-on / Product Variant
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                >
                  <option value="">None (Standard Base Configuration)</option>
                  {availableVariants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.productName} - {v.variant_name} ({v.attribute_value}) [+₹{Number(v.additional_price).toFixed(2)}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Coupon / Promo Code */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Promo / Discount Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME10"
                    className="w-full p-2 uppercase border border-slate-300 rounded-xl pl-8"
                  />
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl"
                >
                  Apply
                </button>
              </div>
              {appliedDiscount && (
                <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Applied {appliedDiscount.code}: {appliedDiscount.discount_value}% discount
                </p>
              )}
              {discountError && (
                <p className="text-[11px] text-rose-600 mt-1">{discountError}</p>
              )}
            </div>

            {/* Cost Breakdown Summary */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal ({quantity} seat{quantity > 1 ? 's' : ''}):</span>
                <span className="font-semibold text-slate-800">₹{pricing.subtotal.toFixed(2)}</span>
              </div>
              {pricing.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({appliedDiscount?.code}):</span>
                  <span>-₹{pricing.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST (18%):</span>
                <span className="font-semibold text-slate-800">+₹{pricing.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount:</span>
                <span className="text-blue-600 font-black">₹{pricing.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Razorpay Payment Method Selector */}
            <div className="border border-slate-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" /> Razorpay Secure Payment
                </span>
                <span className="text-[10px] font-semibold text-slate-400">Sandbox Test Mode</span>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg text-center font-semibold text-[11px]">
                <button
                  type="button"
                  onClick={() => setPaymentTab('upi')}
                  className={`py-1.5 rounded-md transition ${paymentTab === 'upi' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  UPI / QR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTab('card')}
                  className={`py-1.5 rounded-md transition ${paymentTab === 'card' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTab('netbanking')}
                  className={`py-1.5 rounded-md transition ${paymentTab === 'netbanking' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Netbanking
                </button>
              </div>

              {paymentTab === 'upi' && (
                <div className="p-2 space-y-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <input
                      type="text"
                      value={testUpiId}
                      onChange={(e) => setTestUpiId(e.target.value)}
                      placeholder="e.g. yourname@upi"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> Supports GPay, PhonePe, Paytm, BHIM and UPI QR
                  </p>
                </div>
              )}

              {paymentTab === 'card' && (
                <div className="p-2 space-y-2 bg-slate-50 rounded-lg">
                  <input
                    type="text"
                    value={testCardNumber}
                    onChange={(e) => setTestCardNumber(e.target.value)}
                    placeholder="Card Number"
                    className="w-full p-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={testCardExpiry}
                      onChange={(e) => setTestCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                    <input
                      type="password"
                      maxLength={4}
                      value={testCardCvv}
                      onChange={(e) => setTestCardCvv(e.target.value)}
                      placeholder="CVV"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              {paymentTab === 'netbanking' && (
                <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Select Bank: HDFC Bank, ICICI, SBI, Axis, Kotak</span>
                  </div>
                </div>
              )}
            </div>

            {/* Authorize & Pay Button */}
            <button
              type="button"
              disabled={processingPayment}
              onClick={handleRazorpayCheckout}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processingPayment ? (
                <span>Processing Razorpay Payment...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Pay ₹{pricing.total.toFixed(2)} with Razorpay</span>
                </>
              )}
            </button>
          </div>
        )}
      </Modal>

      {/* CREATE PLAN MODAL (ADMIN ONLY) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Subscription Plan"
      >
        <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Plan Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Enterprise Annual Contract"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Included modules, user tiers..."
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="18500.00"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Billing Frequency *</label>
              <select
                value={form.billingFrequency}
                onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })}
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
              <label className="block font-semibold text-slate-700 mb-1">Minimum Quantity</label>
              <input
                type="number"
                min="1"
                value={form.minQuantity}
                onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div className="flex flex-col justify-center space-y-2 pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowPause}
                  onChange={(e) => setForm({ ...form, allowPause: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>Allow Pausing</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoClose}
                  onChange={(e) => setForm({ ...form, autoClose: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>Auto-Close on Expiry</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
          >
            Save Subscription Plan
          </button>
        </form>
      </Modal>
    </div>
  );
}
