import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ loading: false, success: false, message: '', devToken: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: false, message: '', devToken: '' });

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setStatus({
        loading: false,
        success: true,
        message: res.message,
        devToken: res.devResetToken || ''
      });
    } catch (err) {
      setStatus({
        loading: false,
        success: false,
        message: err.message || 'Failed to request password reset.'
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-2xl font-extrabold text-slate-900">
          Reset Password
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Enter your registered email and we'll dispatch a secure reset link.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {status.message && (
            <div className={`mb-4 p-3 rounded-xl flex items-start gap-2 text-sm ${status.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
              {status.success ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />}
              <div>
                <p>{status.message}</p>
                {status.devToken && (
                  <div className="mt-2 pt-2 border-t border-emerald-200 text-xs">
                    <p className="font-semibold text-emerald-900">Direct Demo Reset Link:</p>
                    <Link
                      to={`/reset-password?token=${status.devToken}`}
                      className="text-blue-600 underline font-mono break-all hover:text-blue-800"
                    >
                      Click here to reset immediately
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registered Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={status.loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {status.loading ? 'Dispatching link...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
