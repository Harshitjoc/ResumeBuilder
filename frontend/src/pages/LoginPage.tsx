import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogIn, UserPlus, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { signUpEmail, signInPassword } from '@/services/supabase'

export default function LoginPage() {
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const navigate = useNavigate()

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
    const name = signUpName.trim()
    try {
      const { data, error } = await signUpEmail(signUpEmailVal, signUpPasswordVal, name || undefined)
      if (error) {
        setSignUpError(error.message || 'Sign up failed')
      } else {
        if (name) {
          const s = useAppStore.getState()
          if (!s.resume.contact.fullName.trim()) {
            s.setResume({ ...s.resume, contact: { ...s.resume.contact, fullName: name } })
          }
        }
        const noSession = Boolean(data?.user && !data.session)
        setSignUpSuccess(noSession)
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

  return (
    <div className="mx-auto max-w-4xl pt-8">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">ResumeBuilder</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Pick up where you left off.
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to sync your resumes to the cloud, or continue locally without an account.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sheet p-6">
          <p className="eyebrow mb-1">Returning</p>
          <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-900">Sign in</h2>
          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="email"
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              placeholder="Email"
              required
              className="input"
            />
            <input
              type="password"
              value={signInPasswordVal}
              onChange={(e) => setSignInPasswordVal(e.target.value)}
              placeholder="Password"
              required
              className="input"
            />
            {signInError && <p className="text-xs text-red-600">{signInError}</p>}
            <button type="submit" disabled={signInSaving} className="btn-ink w-full">
              {signInSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Sign in
            </button>
          </form>
        </div>

        <div className="sheet p-6">
          <p className="eyebrow mb-1">New here</p>
          <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-900">New to ResumeBuilder?</h2>
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
                placeholder="Full name"
                required
                className="input"
              />
              <input
                type="email"
                value={signUpEmailVal}
                onChange={(e) => setSignUpEmailVal(e.target.value)}
                placeholder="Email"
                required
                className="input"
              />
              <input
                type="password"
                value={signUpPasswordVal}
                onChange={(e) => setSignUpPasswordVal(e.target.value)}
                placeholder="Password"
                required
                className="input"
              />
              {signUpError && <p className="text-xs text-red-600">{signUpError}</p>}
              <button type="submit" disabled={signUpSaving} className="btn-ghost w-full">
                {signUpSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create account
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={() => navigate('/builder', { replace: true })}
          className="text-sm text-slate-500 underline decoration-blue-400 underline-offset-2 hover:text-slate-800"
        >
          Continue without an account
        </button>
      </div>
    </div>
  )
}