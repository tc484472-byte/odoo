import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Users, UserPlus, Shield, Check, X, AlertCircle } from 'lucide-react';

export function StaffPage() {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: ''
  });

  const checks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password)
  };
  const isPasswordValid = checks.length && checks.upper && checks.lower && checks.special;

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users?role=staff');
      if (res.success) {
        setStaffList(res.users);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      alert('Password does not satisfy complexity requirements.');
      return;
    }

    try {
      const res = await api.post('/users/staff', form);
      if (res.success) {
        setIsModalOpen(false);
        setForm({ fullName: '', email: '', phone: '', password: '' });
        setAlertMsg({ text: `Staff member "${res.staff.full_name}" created successfully!`, type: 'success' });
        fetchStaff();
      }
    } catch (err) {
      alert(err.message || 'Failed to create staff account');
    }
  };

  const handleToggleStatus = async (staffUser) => {
    const nextStatus = !staffUser.is_active;
    try {
      const res = await api.patch(`/users/${staffUser.id}/status`, { isActive: nextStatus });
      if (res.success) {
        setAlertMsg({ text: `Staff user status updated.`, type: 'success' });
        fetchStaff();
      }
    } catch (err) {
      alert(err.message || 'Failed to update user status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Internal Staff Accounts (Admin Only)
          </h1>
          <p className="text-sm text-slate-500">
            Create and manage sales and operational staff members authorized to issue quotations, invoices, and record payments.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff Account
        </button>
      </div>

      {alertMsg.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${alertMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {alertMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Loading staff accounts...</td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No staff members created yet.</td>
                </tr>
              ) : (
                staffList.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{st.full_name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{st.email}</td>
                    <td className="py-3.5 px-4 text-slate-600">{st.phone || 'N/A'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                        {st.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {st.is_active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Deactivated</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(st)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${st.is_active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                      >
                        {st.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Internal Staff Account"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g. Liam Miller"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="staff@brightloop.com"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43211"
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Temporary Password *</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 8 chars, uppercase, lowercase, special"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          {/* Validation Checklist */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="font-semibold text-slate-700 block text-[11px]">Security Requirements:</span>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <span className={checks.length ? 'text-emerald-600 font-medium' : 'text-slate-400'}>• Min 8 characters</span>
              <span className={checks.upper ? 'text-emerald-600 font-medium' : 'text-slate-400'}>• 1 uppercase</span>
              <span className={checks.lower ? 'text-emerald-600 font-medium' : 'text-slate-400'}>• 1 lowercase</span>
              <span className={checks.special ? 'text-emerald-600 font-medium' : 'text-slate-400'}>• 1 special char</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isPasswordValid}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
          >
            Create Staff Account
          </button>
        </form>
      </Modal>
    </div>
  );
}
