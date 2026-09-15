import { LogOut, Cloud, CloudOff } from 'lucide-react'
import { isSupabaseConfigured, signOut } from '@/services/supabase'
import { setUserId } from '@/services/clientKey'
import { useAppStore } from '@/store/appStore'
import { Link } from 'react-router-dom'

export default function AuthWidget() {
  const sessionUser = useAppStore((s) => s.sessionUser)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const clearSession = useAppStore((s) => s.clearSession)

  if (!isSupabaseConfigured) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <CloudOff className="h-3.5 w-3.5" />
        Set VITE_SUPABASE_URL to enable cloud sync
      </span>
    )
  }

  if (sessionStatus === 'loading') {
    return <span className="eyebrow">Loading…</span>
  }

  if (sessionUser) {
    const handleSignOut = async () => {
      await signOut()
      clearSession()
      setUserId(null)
    }

    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-emerald-700">
          <Cloud className="h-3 w-3" />
          {sessionUser.email ?? 'Anonymous'}
        </span>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    )
  }

  return (
    <Link
      to="/login"
      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
    >
      Sign in
    </Link>
  )
}