import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LogIn, UserPlus, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { signUpEmail, signInPassword, signInAnonymously } from '@/services/supabase'

export default function LoginPage() {
  const sessionStatus = useAppStore((s) => s.sessionStatus)

  const [signInEmail, setSignInEmail] = useState('')
  const [signInPasswordVal, setSignInPasswordVal] = useState('')
  const [signInError, setSignInError] = useState('')
  const [signInSaving, setSignInSaving] = useState(false)

  const [signUpName, setSignUpName] = useState('')
  const [signUpEmailVal, setSignUpEmailVal] = useState('')
  const [signUpPasswordVal, setSignUpPasswordVal] = useState('')
  const [signUpError, setSignUpError] = useState('')
  const [signUpSaving, setSignUpSaving] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  const [anonSaving, setAnonSaving] = useState(false)

  if (sessionStatus === 'signed-in' || sessionStatus === 'anonymous') {
    return <Navigate to="/" replace />
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignInError('')
    setSignInSaving(true)
    try {
      const { error } = await signInPassword(signInEmail, signInPasswordVal)
      if (error) setSignInError(error.message || 'Sign in failed')
      else {
        setSignInEmail('')
        setSignInPasswordVal('')
      }
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSignInSaving(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignUpError('')
    setSignUpSaving(true)
    try {
      const { data, error } = await signUpEmail(signUpEmailVal, signUpPasswordVal, signUpName || undefined)
      if (error) {
        setSignUpError(error.message || 'Sign up failed')
      } else if (data?.user && !data.session) {
        setSignUpSuccess(true)
        setSignUpName('')
        setSignUpEmailVal('')
        setSignUpPasswordVal('')
      } else {
        setSignUpName('')
        setSignUpEmailVal('')
        setSignUpPasswordVal('')
      }
    } catch (err) {
      setSignUpError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setSignUpSaving(false)
    }
  }

  const handleAnonymous = async () => {
    setAnonSaving(true)
    try {
      await signInAnonymously()
    } catch {
      // silent — useAuthEffects handles fallback
    } finally {
      setAnonSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-8">
      <h1 className="text-center text-2xl font-bold text-slate-900">Welcome to ResumeBuilder</h1>
      <p className="text-center text-sm text-slate-500">
        Sign in to sync your resumes to the cloud, or try it out anonymously.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <LogIn className="h-5 w-5 text-slate-600" />
            Sign in
          </h2>
          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="email"
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <input
              type="password"
              value={signInPasswordVal}
              onChange={(e) => setSignInPasswordVal(e.target.value)}
              placeholder="Password"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {signInError && <p className="text-xs text-red-600">{signInError}</p>}
            <button
              type="submit"
              disabled={signInSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {signInSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Sign in
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <UserPlus className="h-5 w-5 text-slate-600" />
            Create account
          </h2>
          {signUpSuccess ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              Check your inbox to confirm your email, then sign in.
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <input
                type="text"
                value={signUpName}
                onChange={(e) => setSignUpName(e.target.value)}
                placeholder="Full name (optional)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <input
                type="email"
                value={signUpEmailVal}
                onChange={(e) => setSignUpEmailVal(e.target.value)}
                placeholder="Email"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <input
                type="password"
                value={signUpPasswordVal}
                onChange={(e) => setSignUpPasswordVal(e.target.value)}
                placeholder="Password"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              {signUpError && <p className="text-xs text-red-600">{signUpError}</p>}
              <button
                type="submit"
                disabled={signUpSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {signUpSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create account
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={handleAnonymous}
          disabled={anonSaving}
          className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 disabled:opacity-50"
        >
          {anonSaving ? 'Signing in...' : 'Try without an account'}
        </button>
      </div>
    </div>
  )
}
