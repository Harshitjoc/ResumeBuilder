import { AlertTriangle, ArrowRight, X } from 'lucide-react'

interface FitWarningModalProps {
  score: number
  recommendation?: string
  concerns?: string[]
  onConfirm: () => void
  onDismiss: () => void
}

export default function FitWarningModal({ score, recommendation, concerns, onConfirm, onDismiss }: FitWarningModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="sheet mx-4 w-full max-w-lg overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="eyebrow">Job-fit analysis</p>
          </div>
          <button onClick={onDismiss} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tracking-tight text-slate-900">{score}</span>
            <span className="font-mono text-sm text-slate-400">/ 100 compatibility</span>
          </div>
          {recommendation && (
            <p className="mb-3 text-sm font-medium text-amber-700">{recommendation}</p>
          )}
          {concerns && concerns.length > 0 && (
            <div className="mb-4 rounded-lg bg-amber-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Key concerns</p>
              <ul className="space-y-1 text-sm text-amber-800">
                {concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm leading-relaxed text-slate-500">
            The AI will still do its best to tailor your resume, but this role may not
            be the strongest match for your current experience. You can proceed or go
            back to review the analysis.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button onClick={onDismiss} className="btn-ghost">
            Go back
          </button>
          <button onClick={onConfirm} className="btn-pencil">
            Customize anyway <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
