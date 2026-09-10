import { useState } from 'react'
import { X, Loader2, Mail, KeyRound } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import {
  isSupabaseConfigured,
  getSession,
  signInPassword,
  linkEmailToAccount,
  claimAnonymousRows,
} from '@/services/supabase'

interface Props {
  onClose: () => void
}

export default function ConversionModal({ onClose }: Props) {
  const sessionUser = useAppStore((s) => s.sessionUser)
  const sessionStatus = useAppStore((s) => s.sessionStatus)

  const [tab, setTab] = useState<'create' | 'claim'>('create')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isSupabaseConfigured) return null

  const isAnonymous = sessionStatus === 'anonymous' || sessionUser?.is_anonymous === true

  const handleClose = () => {
    if (!saving) onClose()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 10) {
      setError('Use a password with at least 10 characters.')
      return
    }
    setSaving(true)
    try {
      const { error } = await linkEmailToAccount(email, password, name || undefined)
      if (error) {
        setError(error.message || 'Could not create your account')
        return
      }
      setMessage(
        'Account created — check your inbox to confirm your email. Your resume data is already linked, so it stays with you either way.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account')
    } finally {
      setSaving(false)
    }
  }

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const { data: anonSession } = await getSession()
      const anonToken = anonSession?.session?.access_token
      if (!anonToken) {
        setError('Could not capture your anonymous session. Please try again.')
        return
      }
      const { error } = await signInPassword(email, password)
      if (error) {
        setError(error.message || 'Sign in failed')
        return
      }
      const result = await claimAnonymousRows(anonToken)
      const counts = (result?.migrated ?? {}) as Record<string, number>
      const total = Object.values(counts).reduce((a: number, b: number) => a + (b || 0), 0)
      setMessage(
        total > 0
          ? `Your anonymous data has been merged into your account (${total} item${total === 1 ? '' : 's'}).`
          : 'Signed in. No anonymous data needed merging.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link your account')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'
  const btnPrimary =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Save & keep your resume</h2>
            <p className="mt-1 text-sm text-slate-500">
              You are using a guest session. Create a free account to keep your work and start downloading PDFs.
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isAnonymous && (
          <div className="mb-4 flex rounded-lg bg-slate-50 p-2 text-sm">
            {(
              [
                ['create', 'Create account', Mail],
                ['claim', 'Use existing account', KeyRound],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key)
                  setError('')
                  setMessage('')
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                  tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        )}

        {message ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>
            <button onClick={handleClose} className={btnPrimary}>
              Done
            </button>
          </div>
        ) : tab === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name (optional)"
              className={inputCls}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={inputCls}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 10 characters)"
              required
              minLength={10}
              className={inputCls}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Create my free account
            </button>
            <p className="text-xs text-slate-400">
              Your current work stays attached to this account — no data is lost during conversion.
            </p>
          </form>
        ) : (
          <form onSubmit={handleClaim} className="space-y-3">
            <p className="text-sm text-slate-500">
              Sign in with your existing ResumeBuilder account and your guest data will be merged into it.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={inputCls}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className={inputCls}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Sign in & merge
            </button>
          </form>
        )}

        {!message && (
          <button
            onClick={handleClose}
            disabled={saving}
            className="mt-3 w-full text-center text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            Continue as guest
          </button>
        )}
      </div>
    </div>
  )
}