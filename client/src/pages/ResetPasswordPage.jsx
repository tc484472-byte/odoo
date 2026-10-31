import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Lock, Check, X, AlertCircle, ArrowLeft } from 'lucide-react';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ loading: false, success: false, message: '' });
  const navigate = useNavigate();

  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)
  };
  const isPasswordValid = checks.length && checks.upper && checks.lower && checks.special;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setStatus({ loading: false, success: false, message: 'Missing password reset token in URL.' });
      return;
    }
    if (!isPasswordValid) {
      setStatus({ loading: false, success: false, message: 'Password does not meet the complexity requirements.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ loading: false, success: false, message: 'Passwords do not match.' });
      return;
    }

    setStatus({ loading: true, success: false, message: '' });
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword });
      setStatus({ loading: false, success: true, message: res.message });
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setStatus({ loading: false, success: false, message: err.message || 'Password reset failed.' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-2xl font-extrabold text-slate-900">
          Set New Password
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Enter and confirm your new secure account password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {status.message && (
            <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-sm ${status.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
              {status.success ? <Check className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />}
              <span>{status.message}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-semibold text-slate-700 mb-2">Requirements:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`flex items-center gap-1.5 ${checks.length ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {checks.length ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} Min 8 chars
                </div>
                <div className={`flex items-center gap-1.5 ${checks.upper ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {checks.upper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} 1 uppercase
                </div>
                <div className={`flex items-center gap-1.5 ${checks.lower ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {checks.lower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} 1 lowercase
                </div>
                <div className={`flex items-center gap-1.5 ${checks.special ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {checks.special ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} 1 special char
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={status.loading || !isPasswordValid}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {status.loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
