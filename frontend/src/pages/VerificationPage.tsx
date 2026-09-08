import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Pencil, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { VerificationChange } from '@/types/resume'

export default function VerificationPage() {
  const pendingChanges = useAppStore((s) => s.pendingChanges)
  const updateChangeAction = useAppStore((s) => s.updateChangeAction)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  if (pendingChanges.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <h1 className="text-lg font-semibold text-slate-900">No pending changes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyze a job and customize your resume to populate the verification queue.
        </p>
        <Link
          to="/jobs"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Go to Job Analysis
        </Link>
      </div>
    )
  }

  const pending = pendingChanges.filter((c) => c.action === 'pending').length
  const allReviewed = pending === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Verification Queue</h1>
          <p className="text-sm text-slate-500">
            {pending} change{pending === 1 ? '' : 's'} awaiting your review. The AI never edits your resume without your approval.
          </p>
        </div>
        {allReviewed && <ReviewedBadge />}
      </div>

      <div className="space-y-4">
        {pendingChanges.map((change) => (
          <ChangeCard
            key={change.id}
            change={change}
            updating={change.action === 'pending'}
            onApprove={() => updateChangeAction(change.id, 'approved')}
            onReject={() => updateChangeAction(change.id, 'rejected')}
            onEditStart={() => {
              setEditingId(change.id)
              setEditText(change.customized)
            }}
            editingId={editingId}
            editText={editText}
            setEditText={setEditText}
            onSaveEdit={() => {
              updateChangeAction(change.id, 'edited')
              setEditingId(null)
            }}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Link
          to="/builder"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Continue to preview
        </Link>
      </div>
    </div>
  )
}

function ChangeCard(props: {
  change: VerificationChange
  updating: boolean
  onApprove: () => void
  onReject: () => void
  onEditStart: () => void
  editingId: string | null
  editText: string
  setEditText: (v: string) => void
  onSaveEdit: () => void
}) {
  const { change, onApprove, onReject, onEditStart } = props
  const isEditing = props.editingId === change.id

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
          {change.section} · {change.changeType.replace(/_/g, ' ')}
        </span>
        <StatusPill action={change.action} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-red-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Original</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{change.original || <em className="text-slate-400">(added / new)</em>}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">Customized</p>
          {isEditing ? (
            <>
              <textarea
                value={props.editText}
                onChange={(e) => props.setEditText(e.target.value)}
                className="min-h-16 w-full rounded border border-emerald-300 bg-white px-2 py-1 text-sm"
              />
              <button onClick={props.onSaveEdit} className="mt-2 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                Save edit
              </button>
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-slate-700">{change.customized || <em className="text-slate-400">(removed)</em>}</p>
          )}
        </div>
      </div>

      {change.reason && (
        <p className="mt-3 text-sm text-slate-500">
          <strong className="text-slate-700">Why:</strong> {change.reason}
        </p>
      )}

      {props.updating && (
        <div className="mt-4 flex gap-2">
          <button onClick={onApprove} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
            <Check className="h-4 w-4" /> Approve
          </button>
          <button onClick={onReject} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
            <X className="h-4 w-4" /> Reject
          </button>
          <button onClick={onEditStart} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        </div>
      )}
    </div>
  )
}

function StatusPill({ action }: { action: VerificationChange['action'] }) {
  const map = {
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    edited: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[action]}`}>{action}</span>
}

function ReviewedBadge() {
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
      All changes reviewed
    </span>
  )
}
