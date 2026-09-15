import { ShieldCheck, FileCheck2, AlertTriangle } from 'lucide-react'
import type { VerifiabilityResult } from '@/types/resume'

export default function TrustBadges({ verifiability }: { verifiability: VerifiabilityResult }) {
  const score = verifiability.honesty_score
  const badges: Array<{ icon: typeof ShieldCheck; label: string; tone: string }> = [
    {
      icon: ShieldCheck,
      label: score >= 90 ? 'Genuine Score ' + score : 'Genuine Score ' + score,
      tone: score >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200',
    },
  ]
  if (verifiability.verified > 0) {
    badges.push({
      icon: FileCheck2,
      label: `${verifiability.verified} claim${verifiability.verified === 1 ? '' : 's'} backed by proof`,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    })
  }
  if (verifiability.unverifiable > 0) {
    badges.push({
      icon: AlertTriangle,
      label: `${verifiability.unverifiable} claim${verifiability.unverifiable === 1 ? '' : 's'} awaiting proof`,
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
    })
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {badges.map((b, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${b.tone}`}
        >
          <b.icon className="h-3.5 w-3.5" /> {b.label}
        </span>
      ))}
    </div>
  )
}