import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CreditCard, Search, Calendar, CheckCircle } from 'lucide-react';

export function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payments');
      if (res.success) {
        setPayments(res.payments);
        setFiltered(res.payments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFiltered(payments);
      return;
    }
    const t = searchTerm.toLowerCase();
    setFiltered(
      payments.filter(p =>
        p.payment_number.toLowerCase().includes(t) ||
        p.invoice_number.toLowerCase().includes(t) ||
        (p.company_name && p.company_name.toLowerCase().includes(t)) ||
        (p.transaction_reference && p.transaction_reference.toLowerCase().includes(t))
      )
    );
  }, [searchTerm, payments]);

  const getMethodBadge = (m) => {
    switch (m) {
      case 'upi':
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200 uppercase">UPI</span>;
      case 'bank_transfer':
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">Bank NEFT/RTGS</span>;
      case 'card':
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">Card</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 text-slate-700 capitalize">{m}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            {user?.role === 'customer' ? 'My Payment Receipts' : 'Payment Reconciliation Ledger'}
          </h1>
          <p className="text-sm text-slate-500">
            {user?.role === 'customer'
              ? 'Complete history of all payments made towards your subscriptions.'
              : 'Audit trail of customer payments, transaction references, methods, and invoice settlements.'}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search payments, invoice, UTR..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Payment #</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Payment Date</th>
                <th className="py-3 px-4">Transaction Ref / UTR</th>
                <th className="py-3 px-4 text-right">Amount Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading payment ledger...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No payment records found.</td>
                </tr>
              ) : (
                filtered.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {pay.payment_number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {pay.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {pay.company_name}
                    </td>
                    <td className="py-3.5 px-4">
                      {getMethodBadge(pay.payment_method)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {pay.payment_date}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {pay.transaction_reference || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-600 text-sm">
                      ₹{Number(pay.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
