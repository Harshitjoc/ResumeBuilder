import { ClipboardCheck } from 'lucide-react'
import type { AtsCheck } from '@/types/resume'

export default function AtsPanel({ check }: { check: AtsCheck }) {
  const c = {
    overall_score: typeof check.overall_score === 'number' ? check.overall_score : 0,
    keyword_notes: Array.isArray(check.keyword_notes) ? check.keyword_notes : [],
    structure_notes: Array.isArray(check.structure_notes) ? check.structure_notes : [],
    formatting_notes: Array.isArray(check.formatting_notes) ? check.formatting_notes : [],
    missing_headers: Array.isArray(check.missing_headers) ? check.missing_headers : [],
    parseability_notes: Array.isArray(check.parseability_notes) ? check.parseability_notes : [],
    contact_present: Boolean(check.contact_present),
    action_items: Array.isArray(check.action_items) ? check.action_items : [],
  }

  const pct = Math.max(0, Math.min(100, c.overall_score))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-900">ATS Check</h2>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${pct >= 60 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-lg font-bold text-slate-900">{c.overall_score}</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.contact_present ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {c.contact_present ? 'Contact info present' : 'Contact info missing'}
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <NoteList title="Keyword notes" items={c.keyword_notes} />
        <NoteList title="Structure notes" items={c.structure_notes} />
        <NoteList title="Formatting notes" items={c.formatting_notes} />
        <NoteList title="Parseability notes" items={c.parseability_notes} />
      </div>

      {c.missing_headers.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-sm font-semibold text-slate-700">Missing headers</p>
          <div className="flex flex-wrap gap-1.5">
            {c.missing_headers.map((h, i) => (
              <span key={i} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {c.action_items.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="mb-1 font-semibold">Action items</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {c.action_items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        ATS check is based on standard parsing heuristics. Results may vary by employer system.
      </p>
    </section>
  )
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">—</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
          {items.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
