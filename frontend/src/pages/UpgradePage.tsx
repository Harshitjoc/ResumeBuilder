import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { QrCode, CheckCircle2, Crown, Loader2, Phone, ArrowLeft, ShieldCheck, Clock, IndianRupee } from 'lucide-react'
import QRCode from 'qrcode'
import { useAppStore } from '@/store/appStore'
import { refreshPlan } from '@/services/plan'
import { getPaymentMeta, createPaymentRequest, myPaymentRequests } from '@/services/llm'
import type { PaymentMeta, PaymentRequestItem } from '@/services/llm'

const STATUS_STYLES: Record<string, string> = {
  pending: 'chip bg-amber-100 text-amber-800',
  approved: 'chip bg-emerald-100 text-emerald-700',
  rejected: 'chip bg-red-100 text-red-700',
}

export default function UpgradePage() {
  const plan = useAppStore((s) => s.plan)
  const tier = plan.tier
  const expiresAt = plan.expiresAt

  const [meta, setMeta] = useState<PaymentMeta | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [utr, setUtr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [myRequests, setMyRequests] = useState<PaymentRequestItem[]>([])

  const loadMine = useCallback(async () => {
    try {
      const res = await myPaymentRequests()
      setMyRequests(res.requests ?? [])
    } catch {
      setMyRequests([])
    }
  }, [])

  useEffect(() => {
    refreshPlan()
    getPaymentMeta().then(setMeta).catch(() => setMeta(null))
    loadMine()
  }, [loadMine])

  const upiUrl = meta?.upiId
    ? `upi://pay?pa=${encodeURIComponent(meta.upiId)}&pn=${encodeURIComponent(
        meta.payeeName || '',
      )}&am=${meta.amount}&cu=${meta.currency}&tn=ResumeBuilderPro`
    : ''

  useEffect(() => {
    if (!upiUrl) return
    QRCode.toDataURL(upiUrl, { width: 220, margin: 1, color: { dark: '#101730', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [upiUrl])

  const handleSubmit = async () => {
    if (!utr.trim()) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await createPaymentRequest(utr.trim(), { email: email.trim() || undefined, name: name.trim() || undefined })
      setMessage({
        kind: 'ok',
        text: `Payment submitted (ref ${res.requestId}) — we'll verify your UTR and unlock Pro, usually within 24 hours.`,
      })
      setUtr('')
      loadMine()
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Submission failed' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="sheet p-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
            <Crown className="h-5 w-5 text-amber-600" />
          </span>
          <div>
            <p className="eyebrow mb-0.5">Plan</p>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Upgrade to Pro</h1>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-500">
          {tier === 'pro'
            ? 'You are on Pro.'
            : 'Unlock ATS checks, cover letters, interview prep, the application tracker, hosted share links and unlimited processing — one payment, twelve months.'}
        </p>
        {tier === 'pro' && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Pro active
            {expiresAt && ` — valid until ${new Date(expiresAt).toLocaleDateString()}`}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {['Unlimited daily processing', 'ATS checks (incl. file upload)', 'Cover letters + interview prep', 'Application tracker', 'Hosted share links + score badge'].map(
            (f) => (
              <span key={f} className="chip bg-blue-50 text-blue-800">
                {f}
              </span>
            ),
          )}
        </div>
      </div>

      {tier === 'free' && (
        <div className="sheet overflow-hidden">
          <div className="border-b border-dashed border-slate-300 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-slate-500" />
                <span className="font-mono text-2xl font-semibold tracking-tight text-slate-900">
                  {meta?.amount ?? '—'}
                </span>
                <span className="eyebrow">{meta?.currency ?? 'INR'} · one time</span>
              </div>
              <span className="ticket">
                <span className="ticket-label">Pro</span>
                <span className="ticket-value">{meta?.subscriptionMonths ?? 12} months</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              No auto-renewal. Pay via any UPI app by scanning the QR (or to{' '}
              <span className="font-mono text-xs text-slate-700">{meta?.upiId ?? 'your UPI ID'}</span>), then share the
              UTR number below.
            </p>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="UPI QR code" className="h-52 w-52 rounded-xl border border-slate-300 bg-white p-1" />
              ) : meta?.upiId ? (
                <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="flex h-52 w-52 flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 text-center text-xs text-slate-400">
                  <QrCode className="h-8 w-8" />
                  Payment not configured.
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-slate-500">
                <span className="eyebrow block mb-1">How it works</span>
                Pay the amount above, then enter your{' '}
                <span className="font-medium text-slate-800">UPI transaction reference (UTR)</span>. We verify the
                credit and unlock Pro — usually within 24 hours.
              </p>
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <Phone className="h-3.5 w-3.5" /> No payment gateway — your money goes straight to the UPI ID above.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <input className="input" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                <input type="email" className="input" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="input font-mono text-xs" placeholder="UPI transaction UTR number *" value={utr} onChange={(e) => setUtr(e.target.value)} />
              </div>
              <button onClick={handleSubmit} disabled={!utr.trim() || submitting} className="btn-pencil">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                I've paid — submit UTR
              </button>
              {message && (
                <p
                  className={`rounded-lg p-3 text-sm ${
                    message.kind === 'ok' ? 'bg-highlight-soft text-slate-800 ring-1 ring-highlight/60' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {message.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {myRequests.length > 0 && (
        <div className="sheet p-6">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Your payment requests</h2>
          </div>
          <div className="space-y-2">
            {myRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-paper px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    UTR <span className="font-mono">{r.utr}</span>
                    {r.amount != null && ` · ${r.amount}`}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <span className={STATUS_STYLES[r.status] ?? ''}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}