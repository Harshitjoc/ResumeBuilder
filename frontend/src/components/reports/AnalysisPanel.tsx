import { Sparkles } from 'lucide-react'
import type { ResumeAnalysis } from '@/services/llm'

export default function AnalysisPanel({ analysis }: { analysis: ResumeAnalysis }) {
  const a = {
    overall_score: typeof analysis.overall_score === 'number' ? analysis.overall_score : 0,
    sections_present: Array.isArray(analysis.sections_present) ? analysis.sections_present : [],
    missing_sections: Array.isArray(analysis.missing_sections) ? analysis.missing_sections : [],
    ats_notes: Array.isArray(analysis.ats_notes) ? analysis.ats_notes : [],
    impact_notes: Array.isArray(analysis.impact_notes) ? analysis.impact_notes : [],
    strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
    suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
  }
  const bars = (v: number) => {
    const pct = Math.max(0, Math.min(100, v))
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${pct >= 60 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-8 text-right text-sm font-semibold">{v}</span>
      </div>
    )
  }
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-900">Resume analysis</h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Overall score</p>
            {bars(a.overall_score)}
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Sections present</p>
            <Chips items={a.sections_present} />
          </div>
          {a.missing_sections.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-700">Missing sections</p>
              <Chips items={a.missing_sections} warn />
            </div>
          )}
        </div>

        <div className="space-y-3 text-sm text-slate-600">
          <NoteList title="ATS / formatting notes" items={a.ats_notes} />
          <NoteList title="Impact notes" items={a.impact_notes} />
          <NoteList title="Strengths" items={a.strengths} />
          <NoteList title="Suggestions" items={a.suggestions} />
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400">
        Analysis is based only on what is in your resume. Suggestions are recommendations — nothing is applied automatically.
      </p>
    </section>
  )
}

export function Chips({ items, warn }: { items: string[]; warn?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">—</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${warn ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
          {s}
        </span>
      ))}
    </div>
  )
}

export function NoteList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {items.length === 0 ? (
        <p className="text-slate-400">—</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4">
          {items.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  )
}