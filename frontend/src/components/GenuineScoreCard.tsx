import { ShieldCheck } from 'lucide-react'
import type { VerifiabilityResult } from '@/types/resume'

export default function GenuineScoreCard({
  verifiability,
  className = '',
}: {
  verifiability: VerifiabilityResult
  className?: string
}) {
  const score = verifiability.honesty_score
  const risky = verifiability.verified + verifiability.unverifiable
  const ringColor =
    score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-red-500'
  const note =
    score >= 90
      ? 'Every quantitative claim on this resume is backed by proof.'
      : score >= 70
        ? 'Most impact claims are proven; a few still need evidence.'
        : 'Several quantitative claims have no attached proof — resolve them before sharing.'

  return (
    <div className={`sheet p-5 print:hidden ${className}`}>
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-4 ${ringColor} border-current`}
        >
          <span className="text-2xl font-black tracking-tight">{score}</span>
        </div>
        <div>
          <p className="eyebrow mb-0.5 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Genuine Score
          </p>
          <p className="text-sm leading-relaxed text-slate-500">
            {risky > 0
              ? `${verifiability.verified} of ${risky} impact claims proven out of ${verifiability.total} total claims.`
              : 'No quantitative claims detected — nothing to prove.'}
          </p>
          <p className={`mt-0.5 text-xs font-medium ${ringColor}`}>{note}</p>
        </div>
      </div>
      {verifiability.flagged.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Needs proof: {verifiability.flagged[0].text.slice(0, 90)}
          {verifiability.flagged.length > 1 ? ` (+${verifiability.flagged.length - 1} more)` : ''}
        </p>
      )}
    </div>
  )
}

export function scoreToBadge(score: number): {
  label: string
  className: string
} {
  if (score >= 90) return { label: 'Honesty Verified', className: 'bg-emerald-600 border-emerald-700' }
  if (score >= 70) return { label: 'Mostly Proven', className: 'bg-amber-500 border-amber-600' }
  return { label: 'Needs Proof', className: 'bg-red-500 border-red-600' }
}