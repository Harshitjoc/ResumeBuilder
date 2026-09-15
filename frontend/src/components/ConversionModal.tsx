import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Loader2, UserPlus } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { isSupabaseConfigured, signUpEmail } from '@/services/supabase'

interface Props {
  onClose: () => void
}

export default function ConversionModal({ onClose }: Props) {
  const sessionStatus = useAppStore((s) => s.sessionStatus)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isSupabaseConfigured) return null
  if (sessionStatus !== 'signed-out') return null

  const handleClose = () => {
    if (!saving) onClose()
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 10) {
      setError('Use a password with at least 10 characters.')
      return
    }
    setSaving(true)
    const fullName = name.trim()
    try {
      const { data, error } = await signUpEmail(email, password, fullName || undefined)
      if (error) {
        setError(error.message || 'Could not create your account')
        return
      }
      if (fullName) {
        const s = useAppStore.getState()
        if (!s.resume.contact.fullName.trim()) {
          s.setResume({ ...s.resume, contact: { ...s.resume.contact, fullName } })
        }
      }
      if (data?.user && !data.session) {
        setMessage(
          'Account created — check your inbox to confirm your email, then sign in here or on the login page.',
        )
      } else {
        setMessage('Account created — printing will start automatically.')
        setTimeout(() => onClose(), 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create an account to export PDF</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a free account to download your resume and sync it across devices.
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

        {message ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>
            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className="input"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="input"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 10 characters)"
              required
              minLength={10}
              className="input"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create free account
            </button>
            <p className="text-center text-xs text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                onClick={handleClose}
                className="font-medium text-blue-600 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        )}

        {!message && (
          <button
            onClick={handleClose}
            disabled={saving}
            className="mt-3 w-full text-center text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            Not now
          </button>
        )}
      </div>
    </div>
  )
}