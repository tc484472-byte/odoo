import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Building, Plus, Search, User, Mail, Phone, MapPin, Check, AlertCircle } from 'lucide-react';

export function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    billingAddress: '',
    gstNumber: ''
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers');
      if (res.success) {
        setCustomers(res.customers);
        setFiltered(res.customers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFiltered(customers);
      return;
    }
    const t = searchTerm.toLowerCase();
    setFiltered(
      customers.filter(c =>
        c.company_name.toLowerCase().includes(t) ||
        c.contact_name.toLowerCase().includes(t) ||
        c.email.toLowerCase().includes(t)
      )
    );
  }, [searchTerm, customers]);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/customers', form);
      if (res.success) {
        setIsModalOpen(false);
        setForm({ companyName: '', contactName: '', email: '', phone: '', billingAddress: '', gstNumber: '' });
        setAlertMsg({ text: `Customer "${res.customer.company_name}" created!`, type: 'success' });
        fetchCustomers();
      }
    } catch (err) {
      alert(err.message || 'Failed to create customer');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Customer Directory
          </h1>
          <p className="text-sm text-slate-500">
            Maintain verified customer accounts, tax identification numbers (GSTIN), and billing addresses.
          </p>
        </div>

        {user?.role !== 'customer' && (
          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customers..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add Customer
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

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-4">Primary Contact</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">GSTIN</th>
                <th className="py-3 px-4">Subscriptions</th>
                <th className="py-3 px-4">Billing Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading customers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No customers found.</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{c.company_name}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{c.contact_name}</td>
                    <td className="py-3.5 px-4 text-blue-600 font-medium">{c.email}</td>
                    <td className="py-3.5 px-4 text-slate-600">{c.phone || 'N/A'}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{c.gst_number || 'N/A'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                        {c.active_subscriptions || 0} active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-[200px] truncate">{c.billing_address || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Customer Record"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Acme Corp Pvt Ltd"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Name *</label>
              <input
                type="text"
                required
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="John Doe"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">GSTIN Number</label>
            <input
              type="text"
              value={form.gstNumber}
              onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
              placeholder="27AABCU9603R1ZM"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Billing Address</label>
            <textarea
              rows={2}
              value={form.billingAddress}
              onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
              placeholder="Street, City, PIN..."
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
          >
            Save Customer
          </button>
        </form>
      </Modal>
    </div>
  );
}
