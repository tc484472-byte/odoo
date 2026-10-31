import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Layers, Plus, Calendar, Check, AlertCircle } from 'lucide-react';

export function PlansPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

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

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/plans');
      if (res.success) {
        setPlans(res.plans);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

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
        fetchPlans();
      }
    } catch (err) {
      alert(err.message || 'Failed to create plan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Subscription Plans
          </h1>
          <p className="text-sm text-slate-500">
            Define recurring billing cycles (daily, weekly, monthly, yearly), minimum seat counts, and renewal policies.
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

      {/* Plans Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">No subscription plans found.</div>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
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
            </div>
          ))
        )}
      </div>

      {/* Create Plan Modal */}
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
