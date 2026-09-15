import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { FileText, Briefcase, ListChecks, Eye, Home, History, LayoutGrid, ShieldCheck, User, FileUp, Crown, Lock } from 'lucide-react'
import AuthWidget from '@/components/AuthWidget'
import { PersonaPicker } from '@/components/PersonaPicker'
import { useAppStore } from '@/store/appStore'
import { refreshPlan } from '@/services/plan'
import { isSupabaseConfigured } from '@/services/supabase'
import { useAuthEffects } from '@/services/useAuthEffects'
import { VisitorGate } from '@/components/Gate'

const publicNavItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/builder', label: 'Resume Builder', icon: FileText },
  { to: '/import', label: 'Import', icon: FileUp },
  { to: '/jobs', label: 'Job Analysis', icon: Briefcase },
  { to: '/preview', label: 'Preview', icon: Eye },
]

const signedInNavItems = [
  { to: '/applications', label: 'Applications', icon: LayoutGrid, featureGate: 'application_tracker' },
  { to: '/history', label: 'History & Reports', icon: History },
  { to: '/verify', label: 'Verification Queue', icon: ListChecks },
]

const utilityNavItems = [
  { to: '/backup', label: 'Backup', icon: Lock },
]

export default function Layout() {
  const tier = useAppStore((s) => s.plan.tier)
  const expiresAt = useAppStore((s) => s.plan.expiresAt)
  const quotaRemaining = useAppStore((s) => s.plan.quotaRemaining)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const role = useAppStore((s) => s.role)
  const features = useAppStore((s) => s.features)
  const { pathname } = useLocation()

  useAuthEffects()

  useEffect(() => {
    refreshPlan()
  }, [])

  if (isSupabaseConfigured && sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Loading…</span>
      </div>
    )
  }

  const publicPaths = ['/login', '/upgrade', '/share']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  const isVisitor = isSupabaseConfigured && sessionStatus === 'signed-out'
  const isSignedIn = sessionStatus === 'signed-in'
  const freeQuota = typeof quotaRemaining === 'number' ? quotaRemaining : 25

  const visitorNavItems = publicNavItems.filter((item) =>
    ['/', '/builder', '/preview'].includes(item.to),
  )

  const visibleNav = isVisitor
    ? visitorNavItems
    : [
        ...publicNavItems,
        ...signedInNavItems.filter((item) => !item.featureGate || features[item.featureGate] !== false),
        ...utilityNavItems,
      ]

  const visitorBlockedPaths = ['/import', '/jobs', '/verify', '/history', '/applications', '/account', '/admin']
  const isVisitorBlocked = isPublic ? false : isVisitor && visitorBlockedPaths.some((p) => pathname.startsWith(p))

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-paper/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1 gap-y-1 px-4 pt-3">
          <span className="mr-8 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 font-mono text-[11px] font-semibold tracking-tight text-white">
              RB
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Resume<span className="text-slate-400">Builder</span>
            </span>
          </span>
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                  />
                  {label}
                  {to === '/applications' && tier !== 'pro' && (
                    <Lock className="h-3 w-3 text-slate-400" />
                  )}
                  {isActive && (
                    <span className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-blue-600" />
                  )}
                </>
              )}
            </NavLink>
          ))}
          <div className="flex flex-1 items-center justify-end gap-2">
            {!isVisitor && <PlanTicket tier={tier} expiresAt={expiresAt} quotaRemaining={freeQuota} />}
            {role === 'admin' && (
              <NavLink
                to="/admin"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </NavLink>
            )}
            {isSignedIn && (
              <NavLink
                to="/account"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                <User className="h-3.5 w-3.5" />
                Account
              </NavLink>
            )}
            <PersonaPicker compact />
            <AuthWidget />
          </div>
        </nav>
        <div className="mx-auto mt-3 max-w-7xl px-4">
          <div className="scan-ruler" style={{ opacity: 0.7 }} aria-hidden="true">
            <span
              className="scan-ruler-fill"
              style={{
                width: tier === 'pro' ? '100%' : `${Math.max(4, Math.min(100, (freeQuota / 25) * 100))}%`,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        {isVisitorBlocked ? <VisitorGate /> : <Outlet />}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8">
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="eyebrow">ResumeBuilder · verification-first resume tool</span>
          <span className="eyebrow">Your keys · your data · your sign-off</span>
        </div>
      </footer>
    </div>
  )
}

function PlanTicket({
  tier,
  expiresAt,
  quotaRemaining,
}: {
  tier: 'free' | 'pro'
  expiresAt: string | null
  quotaRemaining: number
}) {
  if (tier === 'pro') {
    const label = expiresAt ? `PRO · ${new Date(expiresAt).toLocaleDateString()}` : 'PRO'
    return (
      <NavLink
        to="/account"
        className="ticket border-emerald-300 bg-emerald-50 text-emerald-700! hover:bg-emerald-100"
        title={`Pro valid until ${expiresAt ? new Date(expiresAt).toLocaleDateString() : 'now'}`}
      >
        <Crown className="h-3 w-3" />
        {label}
      </NavLink>
    )
  }
  return (
    <NavLink to="/upgrade" className="ticket hover:bg-slate-50" title={`${quotaRemaining} free calls left today — upgrade for unlimited`}>
      <span className="ticket-label">Plan</span>
      <span className="ticket-value">Free</span>
      <span className="ticket-label text-slate-400">Left</span>
      <span className="ticket-value text-blue-700!">{quotaRemaining}</span>
    </NavLink>
  )
}