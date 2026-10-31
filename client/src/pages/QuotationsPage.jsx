import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle,
  Eye,
  Calendar,
  Building,
  Check,
  AlertCircle
} from 'lucide-react';

export function QuotationsPage() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quoteDetails, setQuoteDetails] = useState(null);
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  // Creation dependencies
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [discounts, setDiscounts] = useState([]);

  // Creation form state
  const [newQuote, setNewQuote] = useState({
    customerId: '',
    planId: '',
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    taxPercent: 18,
    discountAmount: 0,
    terms: 'Payment due within 30 days upon confirmation.',
    notes: '',
    items: []
  });

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/quotations');
      if (res.success) {
        setQuotations(res.quotations);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [cRes, plRes, prRes, tRes, dRes] = await Promise.all([
        api.get('/customers'),
        api.get('/plans'),
        api.get('/products'),
        api.get('/taxes'),
        api.get('/discounts')
      ]);
      if (cRes.success) setCustomers(cRes.customers);
      if (plRes.success) setPlans(plRes.plans);
      if (prRes.success) setProducts(prRes.products);
      if (tRes.success) setTaxes(tRes.taxes);
      if (dRes.success) setDiscounts(dRes.discounts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchQuotations();
    loadData();
  }, []);

  const handleAddItem = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setNewQuote({
      ...newQuote,
      items: [
        ...newQuote.items,
        {
          productId: defaultProd.id,
          variantId: defaultProd.variants && defaultProd.variants.length > 0 ? defaultProd.variants[0].id : '',
          quantity: 1,
          description: defaultProd.name
        }
      ]
    });
  };

  const handleRemoveItem = (index) => {
    const updated = [...newQuote.items];
    updated.splice(index, 1);
    setNewQuote({ ...newQuote, items: updated });
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...newQuote.items];
    updated[index][field] = value;

    if (field === 'productId') {
      const prod = products.find(p => String(p.id) === String(value));
      if (prod) {
        updated[index].description = prod.name;
        updated[index].variantId = prod.variants && prod.variants.length > 0 ? prod.variants[0].id : '';
      }
    }

    setNewQuote({ ...newQuote, items: updated });
  };

  // Calculate Quotation Totals live in UI
  const calculateFormTotals = () => {
    let subtotal = 0;
    newQuote.items.forEach(it => {
      const prod = products.find(p => String(p.id) === String(it.productId));
      if (prod) {
        let price = Number(prod.sales_price);
        if (it.variantId) {
          const v = prod.variants.find(va => String(va.id) === String(it.variantId));
          if (v) price += Number(v.additional_price);
        }
        subtotal += price * Number(it.quantity || 1);
      }
    });

    const discount = Math.min(subtotal, Math.max(0, Number(newQuote.discountAmount || 0)));
    const taxable = Math.max(0, subtotal - discount);
    const tax = Number(((taxable * Number(newQuote.taxPercent || 0)) / 100).toFixed(2));
    const total = Number((taxable + tax).toFixed(2));

    return { subtotal, discount, tax, total };
  };

  // Submit Quotation
  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    if (newQuote.items.length === 0) {
      alert('Please add at least one product line item to the quotation.');
      return;
    }

    try {
      const res = await api.post('/quotations', newQuote);
      if (res.success) {
        setIsCreateOpen(false);
        setAlertMsg({ text: `Quotation ${res.quotation.quotation_number} saved successfully!`, type: 'success' });
        fetchQuotations();
      }
    } catch (err) {
      alert(err.message || 'Failed to create quotation');
    }
  };

  // Confirm Quotation into Subscription
  const handleConfirmQuotation = async (id) => {
    if (!window.confirm('Confirming this quotation will automatically convert it into an Active Subscription. Proceed?')) return;

    try {
      const res = await api.post(`/quotations/${id}/confirm`, {});
      if (res.success) {
        setAlertMsg({ text: res.message, type: 'success' });
        fetchQuotations();
        if (selectedQuote?.id === id) {
          setSelectedQuote(null);
        }
      }
    } catch (err) {
      setAlertMsg({ text: err.message || 'Quotation confirmation failed', type: 'error' });
    }
  };

  const handleViewQuote = async (q) => {
    setSelectedQuote(q);
    try {
      const res = await api.get(`/quotations/${q.id}`);
      if (res.success) {
        setQuoteDetails(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const totals = calculateFormTotals();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Quotation Management
          </h1>
          <p className="text-sm text-slate-500">
            Build customized subscription quotes, configure product variants, taxes & discounts, and convert confirmed quotes into subscriptions.
          </p>
        </div>

        {user?.role !== 'customer' && (
          <button
            onClick={() => {
              setIsCreateOpen(true);
              if (newQuote.items.length === 0) handleAddItem();
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create Quotation
          </button>
        )}
      </div>

      {alertMsg.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${alertMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {alertMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Quotations List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Quote #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Valid Until</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Discount</th>
                <th className="py-3 px-4 text-right">Tax</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Loading quotations...</td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">No quotations found.</td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-blue-600">{q.quotation_number}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">{q.company_name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{q.valid_until}</td>
                    <td className="py-3.5 px-4 text-right text-slate-600">₹{Number(q.subtotal).toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right text-emerald-600">-₹{Number(q.discount_amount).toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right text-slate-600">₹{Number(q.tax_amount).toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">₹{Number(q.total_amount).toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${
                        q.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        q.status === 'draft' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewQuote(q)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {q.status === 'draft' && user?.role !== 'customer' && (
                          <button
                            onClick={() => handleConfirmQuotation(q.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs transition flex items-center gap-1 shadow-xs"
                            title="Turn into Subscription"
                          >
                            <Check className="w-3.5 h-3.5" /> Confirm Quote
                          </button>
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

      {/* Create Quotation Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Quotation"
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleCreateQuotation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer *</label>
              <select
                required
                value={newQuote.customerId}
                onChange={(e) => setNewQuote({ ...newQuote, customerId: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name} ({c.contact_name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Plan (Optional)</label>
              <select
                value={newQuote.planId}
                onChange={(e) => setNewQuote({ ...newQuote, planId: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No specific plan / Custom --</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Valid Until Date *</label>
              <input
                type="date"
                required
                value={newQuote.validUntil}
                onChange={(e) => setNewQuote({ ...newQuote, validUntil: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Line Items Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Quotation Line Items & Variants
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product Line
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
              {newQuote.items.map((it, idx) => {
                const selectedProd = products.find(p => String(p.id) === String(it.productId));
                return (
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] text-slate-400">Product</label>
                      <select
                        value={it.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (Base ₹{p.sales_price})</option>
                        ))}
                      </select>
                    </div>

                    {selectedProd && selectedProd.variants && selectedProd.variants.length > 0 && (
                      <div className="w-full sm:w-56">
                        <label className="block text-[10px] text-slate-400">Variant (e.g. Odoo +560)</label>
                        <select
                          value={it.variantId}
                          onChange={(e) => handleItemChange(idx, 'variantId', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded-lg text-xs text-blue-700 font-medium"
                        >
                          {selectedProd.variants.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.variant_name}: {v.attribute_value} (+₹{v.additional_price})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="w-full sm:w-20">
                      <label className="block text-[10px] text-slate-400">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10)))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg self-end sm:self-center transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Adjustments: Discount & Tax */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newQuote.discountAmount}
                onChange={(e) => setNewQuote({ ...newQuote, discountAmount: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Applicable Tax Rate</label>
              <select
                value={newQuote.taxPercent}
                onChange={(e) => setNewQuote({ ...newQuote, taxPercent: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs"
              >
                {taxes.map(t => (
                  <option key={t.id} value={t.rate_percent}>{t.name} ({t.rate_percent}%)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Real-time Calculation Summary */}
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Subtotal:</span>
              <span className="font-semibold">₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>Applied Discount:</span>
              <span>-₹{totals.discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tax ({newQuote.taxPercent}%):</span>
              <span>₹{totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-800 text-white">
              <span>Final Quotation Total:</span>
              <span className="text-blue-400">₹{totals.total.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
          >
            Save Quotation
          </button>
        </form>
      </Modal>

      {/* View Quotation Details Modal */}
      <Modal
        isOpen={!!selectedQuote}
        onClose={() => { setSelectedQuote(null); setQuoteDetails(null); }}
        title={`Quotation: ${selectedQuote?.quotation_number}`}
      >
        {quoteDetails && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block">Customer</span>
                <span className="font-bold text-slate-800">{quoteDetails.quotation.company_name}</span>
                <span className="text-slate-500 block">{quoteDetails.quotation.customer_email}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Validity</span>
                <span className="font-bold text-slate-800">{quoteDetails.quotation.valid_until}</span>
                <span className="text-slate-500 block">Terms: {quoteDetails.quotation.terms}</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold uppercase tracking-wider text-slate-500 mb-2">Quotation Line Items</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2">Qty</th>
                      <th className="p-2 text-right">Unit Price</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quoteDetails.items.map(it => (
                      <tr key={it.id}>
                        <td className="p-2 font-medium">
                          {it.description}
                          {it.attribute_value && <span className="block text-[10px] text-blue-600">Variant: {it.attribute_value}</span>}
                        </td>
                        <td className="p-2">{it.quantity}</td>
                        <td className="p-2 text-right">₹{Number(it.unit_price).toFixed(2)}</td>
                        <td className="p-2 text-right font-bold">₹{Number(it.total_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-right">
              <div>Subtotal: <strong>₹{Number(quoteDetails.quotation.subtotal).toFixed(2)}</strong></div>
              <div className="text-emerald-700">Discount: -₹{Number(quoteDetails.quotation.discount_amount).toFixed(2)}</div>
              <div>Tax: ₹{Number(quoteDetails.quotation.tax_amount).toFixed(2)}</div>
              <div className="text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                Grand Total: ₹{Number(quoteDetails.quotation.total_amount).toFixed(2)}
              </div>
            </div>

            {quoteDetails.quotation.status === 'draft' && user?.role !== 'customer' && (
              <button
                onClick={() => handleConfirmQuotation(quoteDetails.quotation.id)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition"
              >
                Confirm Quotation & Convert to Active Subscription
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
