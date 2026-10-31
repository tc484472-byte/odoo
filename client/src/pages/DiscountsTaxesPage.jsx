import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Percent, Plus, Tag, Check, AlertCircle } from 'lucide-react';

export function DiscountsTaxesPage() {
  const { user } = useAuth();
  const [discounts, setDiscounts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  // Forms
  const [discountForm, setDiscountForm] = useState({
    name: '',
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minQuantity: 0,
    minOrderValue: 0,
    maxUsageLimit: ''
  });

  const [taxForm, setTaxForm] = useState({
    name: '',
    ratePercent: '',
    description: '',
    applicableScope: 'all'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dRes, tRes] = await Promise.all([
        api.get('/discounts'),
        api.get('/taxes')
      ]);
      if (dRes.success) setDiscounts(dRes.discounts);
      if (tRes.success) setTaxes(tRes.taxes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDiscount = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/discounts', {
        ...discountForm,
        discountValue: parseFloat(discountForm.discountValue),
        minQuantity: parseInt(discountForm.minQuantity || 0, 10),
        minOrderValue: parseFloat(discountForm.minOrderValue || 0),
        maxUsageLimit: discountForm.maxUsageLimit ? parseInt(discountForm.maxUsageLimit, 10) : null
      });
      if (res.success) {
        setIsDiscountModalOpen(false);
        setAlertMsg({ text: `Discount rule "${res.discount.code}" created!`, type: 'success' });
        fetchData();
      }
    } catch (err) {
      alert(err.message || 'Failed to create discount');
    }
  };

  const handleCreateTax = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/taxes', {
        ...taxForm,
        ratePercent: parseFloat(taxForm.ratePercent)
      });
      if (res.success) {
        setIsTaxModalOpen(false);
        setAlertMsg({ text: `Tax rule "${res.tax.name}" created!`, type: 'success' });
        fetchData();
      }
    } catch (err) {
      alert(err.message || 'Failed to create tax rule');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Percent className="w-5 h-5 text-blue-600" />
            Pricing Rules: Discounts & Taxes
          </h1>
          <p className="text-sm text-slate-500">
            Configure automated percentage & fixed discounts, coupon code redemption rules, and GST/VAT tax rates.
          </p>
        </div>

        {user?.role === 'admin' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDiscountModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add Discount
            </button>
            <button
              onClick={() => setIsTaxModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Add Tax Rule
            </button>
          </div>
        )}
      </div>

      {alertMsg.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${alertMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {alertMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Grid: Left Discounts, Right Taxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discounts Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-emerald-600" /> Discount & Coupon Rules
            </h2>
            <span className="text-xs text-slate-400">{discounts.length} Rules Active</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {discounts.length === 0 ? (
              <div className="p-6 text-center text-slate-400">No discounts configured.</div>
            ) : (
              discounts.map((d) => (
                <div key={d.id} className="p-4 hover:bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {d.code}
                      </span>
                      <span className="font-semibold text-slate-900">{d.name}</span>
                    </div>
                    <p className="text-slate-500">
                      Min Order: ₹{d.min_order_value || 0} | Min Qty: {d.min_quantity || 0} | Usage: {d.current_usage_count} / {d.max_usage_limit || '∞'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-600 block">
                      {d.discount_type === 'percentage' ? `${d.discount_value}% OFF` : `₹${d.discount_value} OFF`}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">{d.applicable_scope} scope</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Taxes Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-blue-600" /> Configurable Tax Rates
            </h2>
            <span className="text-xs text-slate-400">{taxes.length} Tax Rules Active</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {taxes.length === 0 ? (
              <div className="p-6 text-center text-slate-400">No tax rates configured.</div>
            ) : (
              taxes.map((t) => (
                <div key={t.id} className="p-4 hover:bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">{t.name}</span>
                    <p className="text-slate-500">{t.description || 'Standard applicable sales tax.'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-blue-600 block">
                      {t.rate_percent}%
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">{t.applicable_scope} products</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Discount Modal */}
      <Modal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        title="Add Discount Rule"
      >
        <form onSubmit={handleCreateDiscount} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Discount Name *</label>
            <input
              type="text"
              required
              value={discountForm.name}
              onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
              placeholder="e.g. Enterprise Volume 10%"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Coupon Code *</label>
              <input
                type="text"
                required
                value={discountForm.code}
                onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value.toUpperCase() })}
                placeholder="VOL10"
                className="w-full p-2 border border-slate-300 rounded-xl font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Discount Type *</label>
              <select
                value={discountForm.discountType}
                onChange={(e) => setDiscountForm({ ...discountForm, discountType: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Value (% or ₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={discountForm.discountValue}
                onChange={(e) => setDiscountForm({ ...discountForm, discountValue: e.target.value })}
                placeholder="10 or 1500"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min Order Value (₹)</label>
              <input
                type="number"
                min="0"
                value={discountForm.minOrderValue}
                onChange={(e) => setDiscountForm({ ...discountForm, minOrderValue: e.target.value })}
                placeholder="0"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min Quantity</label>
              <input
                type="number"
                min="0"
                value={discountForm.minQuantity}
                onChange={(e) => setDiscountForm({ ...discountForm, minQuantity: e.target.value })}
                placeholder="0"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Redemptions Limit</label>
              <input
                type="number"
                min="1"
                value={discountForm.maxUsageLimit}
                onChange={(e) => setDiscountForm({ ...discountForm, maxUsageLimit: e.target.value })}
                placeholder="Unlimited if empty"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
          >
            Save Discount Rule
          </button>
        </form>
      </Modal>

      {/* Create Tax Modal */}
      <Modal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        title="Add Configurable Tax Rate"
      >
        <form onSubmit={handleCreateTax} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tax Name *</label>
            <input
              type="text"
              required
              value={taxForm.name}
              onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
              placeholder="e.g. GST 18%, VAT 5%"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tax Rate Percentage (%) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                value={taxForm.ratePercent}
                onChange={(e) => setTaxForm({ ...taxForm, ratePercent: e.target.value })}
                placeholder="18.00"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Applicable Scope</label>
              <select
                value={taxForm.applicableScope}
                onChange={(e) => setTaxForm({ ...taxForm, applicableScope: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl"
              >
                <option value="all">All Products & Services</option>
                <option value="service">Services Only</option>
                <option value="product">Products Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={taxForm.description}
              onChange={(e) => setTaxForm({ ...taxForm, description: e.target.value })}
              placeholder="Regulatory description, SAC codes..."
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
          >
            Save Tax Rule
          </button>
        </form>
      </Modal>
    </div>
  );
}
