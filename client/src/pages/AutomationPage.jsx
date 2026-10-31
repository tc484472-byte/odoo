import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Cpu,
  Play,
  Clock,
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Terminal,
  Code
} from 'lucide-react';

export function AutomationPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState('');
  const [feedback, setFeedback] = useState({ text: '', type: '' });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/automation/logs');
      if (res.success) {
        setLogs(res.logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const triggerJob = async (endpoint, jobLabel) => {
    setRunningJob(jobLabel);
    setFeedback({ text: '', type: '' });
    try {
      const res = await api.post(`/automation/${endpoint}`, {});
      setFeedback({ text: res.message, type: 'success' });
      fetchLogs();
    } catch (err) {
      setFeedback({ text: err.message || `Failed to run ${jobLabel}`, type: 'error' });
    } finally {
      setRunningJob('');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Success
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Partial
          </span>
        );
      case 'failure':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Automation Engine & Scheduled Cron Jobs
          </h1>
          <p className="text-sm text-slate-500">
            Centralized automation engine running daily recurring billing, overdue invoice audits, and renewal reminders.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition self-start sm:self-auto"
          title="Refresh Logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {feedback.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Manual Trigger Command Center for Demo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Trigger 1: Billing */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Daily Recurring Billing</h3>
            <p className="text-xs text-slate-500 mb-4">
              Identifies due subscriptions, generates invoices with taxes & discounts, advances next billing dates.
            </p>
          </div>
          <button
            onClick={() => triggerJob('run-billing', 'Recurring Billing')}
            disabled={!!runningJob}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {runningJob === 'Recurring Billing' ? 'Running Job...' : 'Run Billing Now'}
          </button>
        </div>

        {/* Trigger 2: Overdue Check */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Overdue Invoice Detection</h3>
            <p className="text-xs text-slate-500 mb-4">
              Scans unpaid confirmed invoices whose due dates have passed and updates status to overdue.
            </p>
          </div>
          <button
            onClick={() => triggerJob('overdue-check', 'Overdue Detection')}
            disabled={!!runningJob}
            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {runningJob === 'Overdue Detection' ? 'Scanning...' : 'Check Overdue Invoices'}
          </button>
        </div>

        {/* Trigger 3: Renewal Reminders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Send Renewal Reminders</h3>
            <p className="text-xs text-slate-500 mb-4">
              Identifies subscriptions expiring within the 7-day horizon and dispatches notification emails.
            </p>
          </div>
          <button
            onClick={() => triggerJob('renewal-reminders', 'Renewal Reminders')}
            disabled={!!runningJob}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {runningJob === 'Renewal Reminders' ? 'Dispatching...' : 'Dispatch Reminders'}
          </button>
        </div>

        {/* Trigger 4: Expiry Check */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Check Expired Subscriptions</h3>
            <p className="text-xs text-slate-500 mb-4">
              Detects past-expiry contracts and transitions status to expired or auto-closes per plan settings.
            </p>
          </div>
          <button
            onClick={() => triggerJob('expiry-check', 'Expiry Check')}
            disabled={!!runningJob}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {runningJob === 'Expiry Check' ? 'Auditing...' : 'Audit Expiries'}
          </button>
        </div>
      </div>

      {/* Deployment & External Cron Integration Note */}
      <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-white font-bold text-sm mb-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          Production Deployment & Render Free Sleep Bypass
        </div>
        <p className="text-slate-400 leading-relaxed mb-3">
          On free cloud tiers (like Render), web instances can sleep after 15 minutes of inactivity. To ensure recurring billing always fires precisely on schedule even when the backend is asleep, our system provides a secure webhook authenticated via the <code className="text-amber-400 font-mono">X-Cron-Key</code> header. You can trigger it using free GitHub Actions:
        </p>
        <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] text-emerald-400 overflow-x-auto">
          curl -X POST https://brightloop-api.onrender.com/api/automation/run-billing \<br/>
          &nbsp;&nbsp;-H "X-Cron-Key: brightloop_cron_secret_hackathon_2026"
        </div>
      </div>

      {/* Automation Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Automation Execution Audit Log</h2>
          <span className="text-xs text-slate-500">{logs.length} Recent Runs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Job Name</th>
                <th className="py-3 px-4">Execution Timestamp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Processed Records</th>
                <th className="py-3 px-4">Execution Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">Loading automation logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">No automation logs recorded yet.</td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 font-mono text-[11px]">
                      {l.job_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(l.executed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(l.status)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {l.processed_count}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-[320px] truncate">
                      {l.details || l.error_message || 'Job executed successfully.'}
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
