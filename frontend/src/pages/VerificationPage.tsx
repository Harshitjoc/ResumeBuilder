import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Pencil, ShieldCheck, Database, Lock, Unlock } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { evidenceFreshness } from '@/services/freshness'
import type { VerificationChange } from '@/types/resume'
import { saveVerificationDecision, saveAnalysisReport, getSessionUser } from '@/services/supabase'
import GenuineScoreCard from '@/components/GenuineScoreCard'
import TrustBadges from '@/components/TrustBadges'
import { computeGenuineScore } from '@/services/verifiability'

export default function VerificationPage() {
  const pendingChanges = useAppStore((s) => s.pendingChanges)
  const updateChangeAction = useAppStore((s) => s.updateChangeAction)
  const resume = useAppStore((s) => s.resume)
  const addReport = useAppStore((s) => s.addReport)
  const setReportCloudId = useAppStore((s) => s.setReportCloudId)
  const evidence = useAppStore((s) => s.evidence)
  const confirmedClaims = useAppStore((s) => s.confirmedClaims)
  const addConfirmedClaims = useAppStore((s) => s.addConfirmedClaims)
  const applyApprovedChanges = useAppStore((s) => s.applyApprovedChanges)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const pending = pendingChanges.filter(
    (c) => c.action === 'pending' || c.action === 'blocked',
  ).length
  const allReviewed = pending === 0
  const honesty = computeGenuineScore({ resume, confirmedClaims, evidence })

  const recordedKey = useRef<string | null>(null)

  useEffect(() => {
    if (pendingChanges.length === 0 || !allReviewed) return
    const changes = pendingChanges.filter((c) => c.action !== 'pending' && c.action !== 'blocked')
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
        verdict: c.verdict,
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

  const recordClaim = useCallback((change: VerificationChange) => {
    if (change.action !== 'approved' && change.action !== 'edited') return
    const verdict = change.verdict ?? (change.evidenceId ? 'confirmed' : 'ai-drafted')
    addConfirmedClaims([
      { text: change.customized, section: change.section, verdict, evidenceId: change.evidenceId },
    ])
  }, [addConfirmedClaims])

  if (pendingChanges.length === 0) {
    return (
      <div className="sheet p-10 text-center">
        <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
        </span>
        <p className="eyebrow mb-1">Review queue</p>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">No pending changes</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
          Analyze a job and customize your resume to populate the verification queue — the AI never edits without your
          sign-off.
        </p>
        <Link
          to="/jobs"
          className="btn-pencil mt-5"
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
          <p className="eyebrow mb-1">Review queue</p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Verification Queue</h1>
          <p className="text-sm text-slate-500">
            {pending} change{pending === 1 ? '' : 's'} awaiting your review. The AI never edits your resume without your approval.
          </p>
        </div>
        {allReviewed && <ReviewedBadge />}
      </div>

      <TrustBadges verifiability={honesty} />
      <GenuineScoreCard verifiability={honesty} />

      {evidence.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          <Database className="h-4 w-4 text-slate-500" />
          <span>Evidence vault: <strong className="text-slate-900">{evidence.length}</strong> item{evidence.length === 1 ? '' : 's'} collected</span>
          {evidenceFreshness(evidence).stale.length > 0 && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
              {evidenceFreshness(evidence).stale.length} stale — refresh before your next application
            </span>
          )}
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
              recordClaim({ ...change, action: 'approved' })
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
              recordClaim({ ...change, action: 'edited' })
              handleSaveDecision(change.id, 'edited')
              setEditingId(null)
            }}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Link
          to={allReviewed ? '/builder' : '#'}
          aria-disabled={!allReviewed}
          className={`btn-ink ${allReviewed ? '' : 'pointer-events-none opacity-40'}`}
          onClick={allReviewed ? () => applyApprovedChanges() : undefined}
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
  const isPending = change.action === 'pending'
  const isBlocked = change.action === 'blocked' || change.verdict === 'unverifiable'
  const addEvidence = useAppStore((s) => s.addEvidence)
  const attachChangeEvidence = useAppStore((s) => s.attachChangeEvidence)
  const evidence = useAppStore((s) => s.evidence)
  const [addedToVault, setAddedToVault] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<string>('')

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

  const handleAttach = () => {
    if (!selectedEvidence) return
    attachChangeEvidence(change.id, selectedEvidence)
    setSelectedEvidence('')
  }

  const showAddButton = (change.action === 'approved' || change.action === 'edited') && !alreadyInVault && !addedToVault
  const unlocked = isBlocked && Boolean(change.evidenceId)

  return (
    <div
      className={`sheet relative p-5 ${
        isPending ? 'border-blue-300 ring-1 ring-blue-200/60' : isBlocked ? 'border-amber-300 ring-1 ring-amber-200/60' : ''
      }`}
    >
      {(isPending || isBlocked) && (
        <span
          className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl"
          style={{ background: 'repeating-linear-gradient(90deg, var(--color-amber-600) 0 10px, transparent 10px 16px)' }}
        />
      )}
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
          {change.section} · {change.changeType.replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-2">
          <ConfidenceBadge confidence={change.confidence} />
          <StatusPill action={change.action} />
        </div>
      </div>

      {isBlocked && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Honesty gate:</strong> this change adds a quantitative claim with no proof. Attach an item from your Evidence
            Vault (or add one) before you can approve it. {unlocked ? 'Proof attached — approve to confirm.' : ''}
          </span>
        </div>
      )}

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
            <button
              onClick={onApprove}
              disabled={isBlocked && !unlocked}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              {isBlocked ? (unlocked ? 'Approve with proof' : 'Approve (needs proof)') : 'Approve'}
            </button>
            <button onClick={onReject} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
              <X className="h-4 w-4" /> {isBlocked ? 'Reject claim' : 'Reject'}
            </button>
            <button onClick={onEditStart} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Pencil className="h-4 w-4" /> Edit
            </button>
          </>
        )}
        {isBlocked && (
          <div className="flex flex-wrap items-center gap-2">
            {evidence.length > 0 ? (
              <>
                <select
                  value={selectedEvidence}
                  onChange={(e) => setSelectedEvidence(e.target.value)}
                  className="max-w-72 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                >
                  <option value="">Choose proof item…</option>
                  {evidence.map((e) => (
                    <option key={e.id} value={e.id}>{e.text.slice(0, 70)}</option>
                  ))}
                </select>
                <button onClick={handleAttach} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">
                  <Unlock className="h-3.5 w-3.5" /> {change.evidenceId ? 'Update proof' : 'Attach proof'}
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500">Attach an item from the Evidence Vault to proceed.</span>
            )}
            {!alreadyInVault && !addedToVault && (
              <button onClick={handleAddToVault} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Database className="h-3.5 w-3.5" /> Add this as proof in vault
              </button>
            )}
          </div>
        )}
        {showAddButton && (
          <button onClick={handleAddToVault} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Database className="h-3.5 w-3.5" /> Add to evidence vault
          </button>
        )}
        {addedToVault && (
          <span className="text-xs font-medium text-emerald-600">Added to vault</span>
        )}
        {change.evidenceId && !isBlocked && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Unlock className="h-3.5 w-3.5" /> Proof attached</span>
        )}
        {unlocked && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Unlock className="h-3.5 w-3.5" /> Proof attached</span>
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
  const map: Record<VerificationChange['action'], string> = {
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    edited: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    blocked: 'bg-orange-100 text-orange-700',
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[action]}`}>{action === 'blocked' ? 'blocked — needs proof' : action}</span>
}

function ReviewedBadge() {
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
      All changes reviewed
    </span>
  )
}
