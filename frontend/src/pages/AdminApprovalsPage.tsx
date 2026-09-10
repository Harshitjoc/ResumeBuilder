import { useState, useCallback } from 'react'
import { ShieldCheck, KeyRound, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { listPaymentRequests, approvePaymentRequest, rejectPaymentRequest } from '@/services/llm'
import type { PaymentRequestItem } from '@/services/llm'
import { refreshPlan } from '@/services/plan'

const STATUS_STYLES: Record<PaymentRequestItem['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function AdminApprovalsPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem('rb-admin-token') ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [requests, setRequests] = useState<PaymentRequestItem[]>([])

  const load = useCallback(async () => {
    if (!token.trim()) return
    setLoading(true)
    setError('')
    sessionStorage.setItem('rb-admin-token', token.trim())
    try {
      const res = await listPaymentRequests(token.trim())
      setRequests(res.requests ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleApprove = async (id: string) => {
    if (!token.trim() || !window.confirm('Approve this payment and unlock Pro?')) return
    setActing(id)
    try {
      await approvePaymentRequest(id, token.trim())
      await load()
      await refreshPlan()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (id: string) => {
    if (!token.trim() || !window.confirm('Reject this payment request?')) return
    setActing(id)
    try {
      await rejectPaymentRequest(id, token.trim())
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejection failed')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-600" />
          <h1 className="text-lg font-semibold text-slate-900">Payment approvals</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="password"
            className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            placeholder="Admin token (from backend .env)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button
            onClick={load}
            disabled={!token.trim() || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Load requests
          </button>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          No payment requests yet. New UTR submissions from /upgrade will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {r.name || r.email || 'Anonymous'}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    UTR <span className="font-mono font-medium text-slate-700">{r.utr}</span>
                    {r.amount != null && ` · amount ${r.amount}`}
                    {r.email && ` · ${r.email}`}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleString()}
                    {r.userId && ' · signed in'}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleApprove(r.id)}
                      disabled={acting === r.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {acting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(r.id)}
                      disabled={acting === r.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                )}
                {r.status !== 'pending' && (
                  <RefreshCw className="h-4 w-4 shrink-0 text-slate-300" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}