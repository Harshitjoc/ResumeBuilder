import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { FileText, Briefcase, ListChecks, Eye, Home, History, LayoutGrid, Crown, ShieldCheck } from 'lucide-react'
import AuthWidget from '@/components/AuthWidget'
import { PersonaPicker } from '@/components/PersonaPicker'
import { useAppStore } from '@/store/appStore'
import { refreshPlan } from '@/services/plan'
import { isSupabaseConfigured } from '@/services/supabase'
import { useAuthEffects } from '@/services/useAuthEffects'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/builder', label: 'Resume Builder', icon: FileText },
  { to: '/jobs', label: 'Job Analysis', icon: Briefcase },
  { to: '/applications', label: 'Applications', icon: LayoutGrid },
  { to: '/history', label: 'History & Reports', icon: History },
  { to: '/verify', label: 'Verification Queue', icon: ListChecks },
  { to: '/preview', label: 'Preview', icon: Eye },
]

export default function Layout() {
  const tier = useAppStore((s) => s.plan.tier)
  const expiresAt = useAppStore((s) => s.plan.expiresAt)
  const quotaRemaining = useAppStore((s) => s.plan.quotaRemaining)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const { pathname } = useLocation()

  useAuthEffects()

  useEffect(() => {
    refreshPlan()
  }, [])

  if (isSupabaseConfigured && sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <span className="text-sm text-slate-400">Loading...</span>
      </div>
    )
  }

  const publicPaths = ['/login', '/upgrade', '/share']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (isSupabaseConfigured && sessionStatus === 'signed-out' && !isPublic) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-3">
          <span className="mr-6 text-lg font-bold text-slate-900">ResumeBuilder</span>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {planBadge(tier, expiresAt, quotaRemaining)}
            <NavLink
              to="/admin"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </NavLink>
            <PersonaPicker compact />
            <AuthWidget />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function planBadge(tier: 'free' | 'pro', expiresAt: string | null, quotaRemaining: number | null) {
  if (tier === 'pro') {
    return (
      <span
        title={expiresAt ? `Pro valid until ${new Date(expiresAt).toLocaleDateString()}` : 'Pro'}
        className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
      >
        <Crown className="h-3.5 w-3.5" />
        Pro
        {expiresAt && (
          <span className="hidden font-normal text-emerald-600 lg:inline">
            · {new Date(expiresAt).toLocaleDateString()}
          </span>
        )}
      </span>
    )
  }
  return (
    <NavLink
      to="/upgrade"
      className="flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700"
      title={typeof quotaRemaining === 'number' ? `${quotaRemaining} free calls left today` : 'Upgrade to Pro'}
    >
      <Crown className="h-3.5 w-3.5" />
      Free · Upgrade
    </NavLink>
  )
}
