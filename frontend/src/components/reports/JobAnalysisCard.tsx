import { Check } from 'lucide-react'
import type { JobAnalysis } from '@/types/resume'

export default function JobAnalysisCard({ analysis }: { analysis: JobAnalysis }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {analysis.jobTitle || 'Job'}
            {analysis.company && <span className="text-slate-500"> at {analysis.company}</span>}
          </h2>
          <p className="text-sm text-slate-500">
            {analysis.roleType} · {analysis.seniorityLevel}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ScoreBadge label="Compatibility" value={analysis.compatibilityScore} />
          <ScoreBadge label="Skill match" value={analysis.skillMatchPercentage} />
        </div>
      </div>

      <p className={`mt-3 text-sm font-medium ${analysis.compatibilityScore >= 60 ? 'text-green-700' : 'text-amber-700'}`}>
        Recommendation: {analysis.recommendation}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <InfoList title="Required skills" items={analysis.requiredSkills} />
        <InfoList title="Your strengths" items={analysis.skillStrengths} />
        <InfoList title="Skill gaps" items={analysis.skillGaps} />
      </div>

      {analysis.concerns.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Concerns:</strong> {analysis.concerns.join(' ')}
        </div>
      )}
    </section>
  )
}

export function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 60 ? 'text-green-700' : value >= 40 ? 'text-amber-700' : 'text-red-700'
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

export function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-slate-700">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">—</p>
      ) : (
        <ul className="space-y-0.5 text-sm text-slate-600">
          {items.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Check className="h-3 w-3 shrink-0 text-slate-400" /> {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}