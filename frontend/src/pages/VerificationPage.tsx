import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Pencil, ShieldCheck, Database } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { VerificationChange } from '@/types/resume'
import { saveVerificationDecision, saveAnalysisReport, getSessionUser } from '@/services/supabase'

export default function VerificationPage() {
  const pendingChanges = useAppStore((s) => s.pendingChanges)
  const updateChangeAction = useAppStore((s) => s.updateChangeAction)
  const resume = useAppStore((s) => s.resume)
  const addReport = useAppStore((s) => s.addReport)
  const setReportCloudId = useAppStore((s) => s.setReportCloudId)
  const evidence = useAppStore((s) => s.evidence)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const pending = pendingChanges.filter((c) => c.action === 'pending').length
  const allReviewed = pending === 0

  const recordedKey = useRef<string | null>(null)

  useEffect(() => {
    if (pendingChanges.length === 0 || !allReviewed) return
    const changes = pendingChanges.filter((c) => c.action !== 'pending')
    if (changes.length === 0) return
    const key = changes.map((c) => `${c.id}:${c.action}`).join('|')
    if (recordedKey.current === key) return
    recordedKey.current = key
    const report = addReport({
      kind: 'verification',
      title: `Verification review — ${new Date().toLocaleDateString()}`,
      score: null,
      payload: changes.map((c) => ({
        section: c.section,
        changeType: c.changeType,
        action: c.action,
        original: c.original,
        customized: c.customized,
        reason: c.reason,
      })),
      resumeSnapshot: resume,
    })
    getSessionUser().then((u) => {
      if (u) {
        saveAnalysisReport(report, u.id)
          .then((cloudId) => setReportCloudId(report.id, cloudId))
          .catch(() => {})
      }
    })
  }, [pendingChanges, allReviewed, resume, addReport, setReportCloudId])

  const handleSaveDecision = useCallback((changeId: string, action: VerificationChange['action']) => {
    const updated = useAppStore.getState().pendingChanges.find((c) => c.id === changeId)
    if (!updated) return
    getSessionUser().then((u) => {
      if (u) {
        saveVerificationDecision({ ...updated, action }, u.id).catch(() => {})
      }
    })
  }, [])

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

      {evidence.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          <Database className="h-4 w-4 text-slate-500" />
          <span>Evidence vault: <strong className="text-slate-900">{evidence.length}</strong> item{evidence.length === 1 ? '' : 's'} collected</span>
          <Link to="/builder" className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700">View in builder →</Link>
        </div>
      )}

      <div className="space-y-4">
        {pendingChanges.map((change) => (
          <ChangeCard
            key={change.id}
            change={change}
            updating={change.action === 'pending'}
            onApprove={() => {
              updateChangeAction(change.id, 'approved')
              handleSaveDecision(change.id, 'approved')
            }}
            onReject={() => {
              updateChangeAction(change.id, 'rejected')
              handleSaveDecision(change.id, 'rejected')
            }}
            onEditStart={() => {
              setEditingId(change.id)
              setEditText(change.customized)
            }}
            editingId={editingId}
            editText={editText}
            setEditText={setEditText}
            onSaveEdit={() => {
              updateChangeAction(change.id, 'edited')
              handleSaveDecision(change.id, 'edited')
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
  const addEvidence = useAppStore((s) => s.addEvidence)
  const evidence = useAppStore((s) => s.evidence)
  const [addedToVault, setAddedToVault] = useState(false)

  const alreadyInVault = evidence.some(
    (e) => e.text === change.customized && e.category === mapSectionToCategory(change.section),
  )

  const handleAddToVault = () => {
    addEvidence({
      category: mapSectionToCategory(change.section),
      text: change.customized,
      confidence: change.confidence ?? 'low',
      source: 'user',
    })
    setAddedToVault(true)
  }

  const showAddButton = (change.action === 'approved' || change.action === 'edited') && !alreadyInVault && !addedToVault

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
          {change.section} · {change.changeType.replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-2">
          <ConfidenceBadge confidence={change.confidence} />
          <StatusPill action={change.action} />
        </div>
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {props.updating && (
          <>
            <button onClick={onApprove} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
              <Check className="h-4 w-4" /> Approve
            </button>
            <button onClick={onReject} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
              <X className="h-4 w-4" /> Reject
            </button>
            <button onClick={onEditStart} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Pencil className="h-4 w-4" /> Edit
            </button>
          </>
        )}
        {showAddButton && (
          <button onClick={handleAddToVault} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Database className="h-3.5 w-3.5" /> Add to evidence vault
          </button>
        )}
        {addedToVault && (
          <span className="text-xs font-medium text-emerald-600">Added to vault</span>
        )}
      </div>
    </div>
  )
}

function mapSectionToCategory(section: string): 'skill' | 'achievement' | 'metric' | 'project' | 'education' | 'certification' {
  const s = section.toLowerCase()
  if (s.includes('skill')) return 'skill'
  if (s.includes('experience') || s.includes('bullet') || s.includes('work')) return 'achievement'
  if (s.includes('metric') || s.includes('quantif')) return 'metric'
  if (s.includes('project')) return 'project'
  if (s.includes('education') || s.includes('degree') || s.includes('school')) return 'education'
  if (s.includes('cert')) return 'certification'
  return 'achievement'
}

function ConfidenceBadge({ confidence }: { confidence?: 'high' | 'medium' | 'low' }) {
  const c = confidence ?? 'low'
  const cls =
    c === 'high' ? 'bg-emerald-100 text-emerald-700' :
    c === 'medium' ? 'bg-blue-100 text-blue-700' :
    'bg-amber-100 text-amber-700'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {c} confidence
    </span>
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
