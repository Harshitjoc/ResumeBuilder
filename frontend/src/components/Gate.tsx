import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Gauge, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

export default function Gate({
  reason,
  inline,
  children,
}: {
  reason?: string
  inline?: boolean
  children: ReactNode
}) {
  const tier = useAppStore((s) => s.plan.tier)
  if (tier === 'pro') return <>{children}</>

  if (inline) {
    return (
      <Link
        to="/upgrade"
        title="Pro feature — unlock with a one-time payment"
        className="relative inline-flex overflow-hidden rounded-lg"
      >
        <span className="pointer-events-none select-none opacity-50">{children}</span>
        <span className="absolute inset-0 flex items-center justify-center gap-1 bg-slate-900/70 text-xs font-semibold text-white">
          <Lock className="h-3.5 w-3.5" />
          Pro
        </span>
      </Link>
    )
  }

  return (
    <div className="sheet mx-auto max-w-md overflow-hidden p-8 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50">
        <Lock className="h-6 w-6 text-blue-600" />
      </div>
      <p className="eyebrow mb-1">Pro feature</p>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        {reason ?? 'This feature is part of Pro.'}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
        Unlock ATS checks, cover letters, interview prep, the application tracker, hosted share links and unlimited
        daily processing.
      </p>
      <Link to="/upgrade" className="btn-pencil mt-5">
        Unlock Pro <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export function VisitorGate() {
  return (
    <div className="sheet mx-auto max-w-md overflow-hidden p-8 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50">
        <Lock className="h-6 w-6 text-blue-600" />
      </div>
      <p className="eyebrow mb-1">Account required</p>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        Sign in or create an account to continue
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
        Create a free account to import resumes, analyze jobs, track applications and more.
      </p>
      <Link to="/login" className="btn-pencil mt-5">
        Continue to sign in <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export function QuotaNotice() {
  const plan = useAppStore((s) => s.plan)
  if (!plan.quotaExceeded) return null
  return (
    <div className="flex items-center gap-2 rounded-lg bg-highlight-soft px-3 py-3 text-sm text-slate-800 ring-1 ring-highlight/60">
      <Gauge className="h-4 w-4 shrink-0" />
      <span>
        Free tier daily limit reached.{' '}
        <Link to="/upgrade" className="font-semibold underline decoration-blue-600 underline-offset-2">
          Upgrade to Pro
        </Link>{' '}
        for unlimited processing.
      </span>
    </div>
  )
}