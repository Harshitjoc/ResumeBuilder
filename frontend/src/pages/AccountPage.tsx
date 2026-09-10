import { useState } from 'react'
import {
  User,
  Crown,
  KeyRound,
  Download,
  Trash2,
  LogOut,
  Loader2,
  FileText,
  History,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ApiKeyManager from '@/components/ApiKeyManager'
import {
  isSupabaseConfigured,
  signOut,
  updatePassword,
} from '@/services/supabase'
import { myPaymentRequests, deleteAccount, type PaymentRequestItem } from '@/services/llm'
import { refreshPlan } from '@/services/plan'
import { resetCloudSyncState } from '@/services/cloudSync'
import { setUserId } from '@/services/clientKey'
import { Link } from 'react-router-dom'

export default function AccountPage() {
  const sessionUser = useAppStore((s) => s.sessionUser)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const plan = useAppStore((s) => s.plan)
  const clearSession = useAppStore((s) => s.clearSession)

  const [requests, setRequests] = useState<PaymentRequestItem[] | null>(null)
  const [password, setPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadRequests = async () => {
    try {
      const res = await myPaymentRequests()
      setRequests(res.requests ?? [])
    } catch {
      setRequests([])
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg('')
    setPwErr('')
    if (password.length < 10) {
      setPwErr('Use a password with at least 10 characters.')
      return
    }
    setPwSaving(true)
    try {
      await updatePassword(password)
      setPwMsg('Password updated.')
      setPassword('')
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setPwSaving(false)
    }
  }

  const handleExport = () => {
    const s = useAppStore.getState()
    const data = {
      exportedAt: new Date().toISOString(),
      resume: s.resume,
      reports: s.reports,
      evidence: s.evidence,
      applications: s.applications,
      shares: s.shares,
      targetUser: s.targetUser,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resume-builder-backup.json`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(true)
    setTimeout(() => setExporting(false), 600)
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete your account and all your data? This cannot be undone.')) return
    if (!window.confirm('Are you sure? All resumes, reports, and applications will be permanently removed.')) return
    setDeleting(true)
    try {
      await deleteAccount()
    } catch {
      /* user may not have backend/supabase connected — still clear locally */
    } finally {
      await signOut()
      clearSession()
      setUserId(null)
      resetCloudSyncState()
      localStorage.removeItem('resume-builder-storage')
      setDeleting(false)
    }
  }

  const handleSignOutEverywhere = async () => {
    await signOut('global')
    clearSession()
    setUserId(null)
    resetCloudSyncState()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <User className="h-5 w-5 text-slate-600" /> Account
      </h1>

      {!isSupabaseConfigured && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Cloud features are off — frontend Supabase env vars are not set.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{sessionUser?.full_name || sessionUser?.email || 'Guest'}</p>
            <p className="text-xs text-slate-500">
              {sessionUser?.email ?? '(anonymous session)'} · {sessionStatus}
              {sessionUser?.is_anonymous ? ' — create or claim an account to download PDFs' : ''}
            </p>
          </div>
          <Link
            to="/upgrade"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <Crown className="h-3.5 w-3.5" />
            {plan.tier === 'pro' ? 'Manage Pro' : 'Upgrade'}
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Plan</p>
            <p className={`text-lg font-bold ${plan.tier === 'pro' ? 'text-emerald-600' : 'text-slate-900'}`}>
              {plan.tier === 'pro' ? 'Pro' : 'Free'}
            </p>
            {plan.expiresAt && (
              <p className="text-xs text-slate-500">Valid until {new Date(plan.expiresAt).toLocaleDateString()}</p>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Today&apos;s quota</p>
            <p className="text-lg font-bold text-slate-900">
              {plan.quotaRemaining === null ? 'Unlimited' : `${plan.quotaRemaining} left`}
            </p>
            {plan.quotaLimit !== null && <p className="text-xs text-slate-500">of {plan.quotaLimit} LLM calls/day</p>}
          </div>
        </div>
        <button
          onClick={() => {
            void loadRequests()
          }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <History className="h-3.5 w-3.5" />
          {requests === null ? 'Show payment history' : 'Refresh payment history'}
        </button>
        {requests && (
          <div className="mt-3 space-y-2">
            {requests.length === 0 ? (
              <p className="text-sm text-slate-400">No payment requests found.</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-mono text-slate-700">{r.utr}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : r.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FileText className="h-4 w-4 text-slate-500" /> API keys (stored only in your browser)
        </h2>
        <ApiKeyManager />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <KeyRound className="h-4 w-4 text-slate-500" /> Security
        </h2>
        <form onSubmit={handleChangePassword} className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 text-xs text-slate-500">
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 10 characters"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={pwSaving}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Change password
          </button>
        </form>
        {pwErr && <p className="mt-2 text-xs text-red-600">{pwErr}</p>}
        {pwMsg && <p className="mt-2 text-xs text-emerald-600">{pwMsg}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleSignOutEverywhere}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out everywhere
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Data</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export data (JSON)
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete account
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Export includes your resume, reports, evidence, applications, shared links, and persona. Deleting your account
          removes your profile, all owned data, and your Supabase identity permanently.
        </p>
        <button
          onClick={async () => {
            await refreshPlan()
          }}
          className="mt-3 text-xs text-slate-400 underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
        >
          Resync membership status
        </button>
      </div>
    </div>
  )
}