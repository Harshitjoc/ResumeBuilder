import { useState, useEffect, useCallback } from 'react'
import { LogIn, LogOut, UserPlus, Cloud, CloudOff } from 'lucide-react'
import {
  supabase,
  isSupabaseConfigured,
  getSessionUser,
  signIn,
  signUp,
  signOut,
} from '@/services/supabase'
import { setUserId } from '@/services/clientKey'
import type { AppUser } from '@/services/supabase'

export default function AuthWidget() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const refreshUser = useCallback(async () => {
    const u = await getSessionUser()
    setUser(u)
    setUserId(u?.id ?? null)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    refreshUser().finally(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = (session?.user as AppUser) ?? null
        setUser(u)
        setUserId(u?.id ?? null)
      },
    )
    return () => subscription.unsubscribe()
  }, [refreshUser])

  if (!isSupabaseConfigured) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <CloudOff className="h-3.5 w-3.5" />
        Set VITE_SUPABASE_URL to enable cloud sync
      </span>
    )
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await signIn(email, password)
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await signUp(email, password)
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setUser(null)
  }

  if (loading) {
    return <span className="text-xs text-slate-400">Loading...</span>
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-green-600">
          <Cloud className="h-3.5 w-3.5" />
          {user.email}
        </span>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <form onSubmit={handleSignIn} className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-36 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs focus:border-slate-500 focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <LogIn className="h-3 w-3" />
          Sign in
        </button>
        <button
          type="button"
          onClick={handleSignUp}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <UserPlus className="h-3 w-3" />
          Sign up
        </button>
      </form>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
