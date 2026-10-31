import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import {
  Receipt,
  Search,
  Plus,
  CreditCard,
  Printer,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  Check
} from 'lucide-react';
import { jsPDF } from 'jspdf';

export function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Active Invoice
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Payment Recording Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [targetInvoiceForPay, setTargetInvoiceForPay] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'upi',
    paymentDate: new Date().toISOString().split('T')[0],
    transactionReference: '',
    notes: ''
  });

  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/invoices');
      if (res.success) {
        setInvoices(res.invoices);
        setFiltered(res.invoices);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    let list = [...invoices];
    if (activeTab !== 'all') {
      list = list.filter(i => i.status.toLowerCase() === activeTab);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(i =>
        i.invoice_number.toLowerCase().includes(term) ||
        (i.company_name && i.company_name.toLowerCase().includes(term))
      );
    }
    setFiltered(list);
  }, [activeTab, searchTerm, invoices]);

  const handleViewInvoice = async (inv) => {
    setSelectedInvoice(inv);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/invoices/${inv.id}`);
      if (res.success) {
        setInvoiceDetails(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const openPaymentModal = (inv) => {
    setTargetInvoiceForPay(inv);
    setPaymentData({
      amount: inv.outstanding_amount, // Pre-fill with outstanding balance
      paymentMethod: 'upi',
      paymentDate: new Date().toISOString().split('T')[0],
      transactionReference: 'TXN-' + Math.floor(100000 + Math.random() * 900000),
      notes: 'Recorded via billing management portal'
    });
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!targetInvoiceForPay) return;

    try {
      const res = await api.post('/payments', {
        invoiceId: targetInvoiceForPay.id,
        amount: parseFloat(paymentData.amount),
        paymentMethod: paymentData.paymentMethod,
        paymentDate: paymentData.paymentDate,
        transactionReference: paymentData.transactionReference,
        notes: paymentData.notes
      });

      if (res.success) {
        setPaymentModalOpen(false);
        setAlertMsg({ text: res.message, type: 'success' });
        fetchInvoices();
        if (selectedInvoice?.id === targetInvoiceForPay.id) {
          handleViewInvoice(targetInvoiceForPay);
        }
      }
    } catch (err) {
      alert(err.message || 'Payment recording failed');
    }
  };

  // Export PDF using jsPDF
  const exportPDF = (invData) => {
    if (!invData) return;
    const { invoice, items } = invData;
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(22);
    doc.setTextColor(12, 135, 235);
    doc.text('BRIGHTLOOP SOFTWARE', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Subscription Billing & Cloud ERP Services', 14, 28);
    doc.text('GSTIN: 27AABCU9603R1ZM | billing@brightloop.com', 14, 34);

    // Invoice Meta (Right side)
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`INVOICE: ${invoice.invoice_number}`, 130, 22);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Invoice Date: ${invoice.invoice_date}`, 130, 28);
    doc.text(`Due Date: ${invoice.due_date}`, 130, 34);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 130, 40);

    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 46, 196, 46);

    // Bill To
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Billed To:', 14, 54);
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(invoice.company_name, 14, 60);
    doc.text(`Contact: ${invoice.contact_name} (${invoice.customer_email})`, 14, 66);
    if (invoice.billing_address) doc.text(`Address: ${invoice.billing_address}`, 14, 72);
    if (invoice.gst_number) doc.text(`Customer GSTIN: ${invoice.gst_number}`, 14, 78);

    // Line items table
    let y = 90;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 8, 'F');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Description', 16, y + 5.5);
    doc.text('Qty', 120, y + 5.5);
    doc.text('Unit Price', 140, y + 5.5);
    doc.text('Amount (INR)', 170, y + 5.5);

    y += 12;
    items.forEach((it) => {
      doc.text(it.description || 'Subscription Line Item', 16, y);
      doc.text(String(it.quantity), 120, y);
      doc.text(`Rs. ${Number(it.unit_price).toFixed(2)}`, 140, y);
      doc.text(`Rs. ${Number(it.total_price).toFixed(2)}`, 170, y);
      y += 8;
    });

    // Totals Box
    y += 10;
    doc.line(14, y, 196, y);
    y += 8;
    doc.text(`Subtotal: Rs. ${Number(invoice.subtotal).toFixed(2)}`, 140, y);
    y += 6;
    doc.text(`Discount: -Rs. ${Number(invoice.discount_amount).toFixed(2)}`, 140, y);
    y += 6;
    doc.text(`Taxes: Rs. ${Number(invoice.tax_amount).toFixed(2)}`, 140, y);
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(12, 135, 235);
    doc.text(`Total Due: Rs. ${Number(invoice.total_amount).toFixed(2)}`, 140, y);

    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(`Amount Paid: Rs. ${Number(invoice.amount_paid).toFixed(2)}`, 140, y);
    y += 6;
    doc.setTextColor(239, 68, 68);
    doc.text(`Outstanding Balance: Rs. ${Number(invoice.outstanding_amount).toFixed(2)}`, 140, y);

    // Save PDF
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</span>;
      case 'confirmed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">Pending / Confirmed</span>;
      case 'overdue':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">Overdue</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 capitalize">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            {user?.role === 'customer' ? 'My Invoices' : 'Invoice & Billing Management'}
          </h1>
          <p className="text-sm text-slate-500">
            {user?.role === 'customer'
              ? 'View recurring bills, outstanding payments, and download official PDF tax invoices.'
              : 'Automated recurring invoice generation, status tracking, payment reconciliation, and PDF receipts.'}
          </p>
        </div>
      </div>

      {alertMsg.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${alertMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {alertMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0">
          {['all', 'confirmed', 'paid', 'overdue', 'cancelled'].map((tab) => (
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
            placeholder="Search invoice number, customer..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Invoice Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Loading invoices...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">No invoices found.</td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {inv.company_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {inv.invoice_date}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {inv.due_date}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                      ₹{Number(inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-rose-600">
                      ₹{Number(inv.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewInvoice(inv)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Invoice & PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Record payment button for staff/admin */}
                        {user?.role !== 'customer' && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => openPaymentModal(inv)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition flex items-center gap-1 shadow-xs"
                            title="Record Payment"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pay
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

      {/* Record Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={`Record Payment for ${targetInvoiceForPay?.invoice_number}`}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex justify-between mb-1">
              <span className="text-slate-500">Invoice Total:</span>
              <span className="font-bold">₹{Number(targetInvoiceForPay?.total_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-rose-600 font-semibold">
              <span>Outstanding Balance:</span>
              <span>₹{Number(targetInvoiceForPay?.outstanding_amount || 0).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={targetInvoiceForPay?.outstanding_amount}
              required
              value={paymentData.amount}
              onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Enter full amount or partial installment.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
              <select
                value={paymentData.paymentMethod}
                onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs capitalize"
              >
                <option value="upi">UPI / QR</option>
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Reference / UTR</label>
            <input
              type="text"
              value={paymentData.transactionReference}
              onChange={(e) => setPaymentData({ ...paymentData, transactionReference: e.target.value })}
              placeholder="UPI/123456789 or Cheque #"
              className="w-full p-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={paymentData.notes}
              onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              placeholder="e.g. Received via customer online portal"
              className="w-full p-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
          >
            Confirm & Record Payment
          </button>
        </form>
      </Modal>

      {/* Invoice Viewer & PDF Export Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => { setSelectedInvoice(null); setInvoiceDetails(null); }}
        title={`Invoice: ${selectedInvoice?.invoice_number}`}
        maxWidth="max-w-3xl"
      >
        {detailsLoading || !invoiceDetails ? (
          <div className="py-8 text-center text-slate-400">Loading invoice details...</div>
        ) : (
          <div className="space-y-6">
            {/* Top action bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xl font-black text-slate-900">{invoiceDetails.invoice.invoice_number}</span>
                <span className="ml-3">{getStatusBadge(invoiceDetails.invoice.status)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-medium text-slate-700 flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => exportPDF(invoiceDetails)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Export PDF
                </button>
              </div>
            </div>

            {/* Invoice Printable View */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-extrabold text-blue-600">BRIGHTLOOP SOFTWARE</h3>
                  <p className="text-slate-500">GSTIN: 27AABCU9603R1ZM</p>
                  <p className="text-slate-500">Cyber City, Gurugram, India</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">Date: {invoiceDetails.invoice.invoice_date}</p>
                  <p className="text-slate-500">Period: {invoiceDetails.invoice.billing_period_start} to {invoiceDetails.invoice.billing_period_end}</p>
                  <p className="font-bold text-rose-600">Due Date: {invoiceDetails.invoice.due_date}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <span className="text-slate-400 uppercase font-bold text-[10px] block">Customer Details:</span>
                <p className="text-sm font-bold text-slate-800">{invoiceDetails.invoice.company_name}</p>
                <p className="text-slate-600">Attn: {invoiceDetails.invoice.contact_name} ({invoiceDetails.invoice.customer_email})</p>
                {invoiceDetails.invoice.billing_address && <p className="text-slate-600">{invoiceDetails.invoice.billing_address}</p>}
                {invoiceDetails.invoice.gst_number && <p className="text-slate-600">Customer GSTIN: {invoiceDetails.invoice.gst_number}</p>}
              </div>

              {/* Items table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Line Item Description</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceDetails.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3 font-medium text-slate-800">
                          {it.description}
                          {it.attribute_value && <span className="block text-[10px] text-blue-600">Variant: {it.attribute_value}</span>}
                        </td>
                        <td className="p-3 text-slate-600">{it.quantity}</td>
                        <td className="p-3 text-right text-slate-600">₹{Number(it.unit_price).toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-slate-900">₹{Number(it.total_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="space-y-1 text-right text-xs pt-2">
                <div>Subtotal: <strong>₹{Number(invoiceDetails.invoice.subtotal).toFixed(2)}</strong></div>
                <div className="text-emerald-700">Discounts: -₹{Number(invoiceDetails.invoice.discount_amount).toFixed(2)}</div>
                <div>Taxes (GST): ₹{Number(invoiceDetails.invoice.tax_amount).toFixed(2)}</div>
                <div className="text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                  Total Billed: ₹{Number(invoiceDetails.invoice.total_amount).toFixed(2)}
                </div>
                <div className="text-emerald-600 font-bold">
                  Amount Paid: ₹{Number(invoiceDetails.invoice.amount_paid).toFixed(2)}
                </div>
                <div className="text-sm font-bold text-rose-600">
                  Remaining Outstanding: ₹{Number(invoiceDetails.invoice.outstanding_amount).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Payments History for this invoice */}
            {invoiceDetails.payments.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Recorded Payments for this Invoice</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Payment #</th>
                        <th className="p-2.5">Method</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Ref / UTR</th>
                        <th className="p-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceDetails.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2.5 font-bold text-blue-600">{p.payment_number}</td>
                          <td className="p-2.5 capitalize">{p.payment_method}</td>
                          <td className="p-2.5 text-slate-600">{p.payment_date}</td>
                          <td className="p-2.5 text-slate-500 font-mono text-[10px]">{p.transaction_reference}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">₹{Number(p.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
