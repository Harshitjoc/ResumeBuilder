import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Gauge } from 'lucide-react'
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
    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <Lock className="mx-auto mb-3 h-10 w-10 text-amber-400" />
      <h2 className="text-lg font-semibold text-slate-900">Pro feature</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        {reason ?? 'This feature is part of Pro.'}
      </p>
      <Link
        to="/upgrade"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
      >
        <Lock className="h-4 w-4" />
        Unlock Pro
      </Link>
    </div>
  )
}

export function QuotaNotice() {
  const plan = useAppStore((s) => s.plan)
  if (!plan.quotaExceeded) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <Gauge className="h-4 w-4 shrink-0" />
      <span>
        Free tier daily limit reached. <Link to="/upgrade" className="font-semibold underline">Upgrade to Pro</Link> for
        unlimited processing.
      </span>
    </div>
  )
}