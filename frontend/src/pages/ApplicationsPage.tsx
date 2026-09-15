import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutGrid, Plus, Trash2, ChevronRight, ChevronLeft, Briefcase,
  ChevronDown, ChevronUp, ShieldCheck, Activity, Database, GraduationCap,
  Sparkles, PackageOpen, X,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { ApplicationRecord, ApplicationStatus, InterviewPrep, KeywordEntry, TruthSummary } from '@/types/resume'
import { gapPatterns, keywordSectionHint, gapHint } from '@/services/applicationDna'
import { generateInterviewPrep } from '@/services/llm'
import { shadowCheck } from '@/services/shadowAts'
import { applicationDecay, type ApplicationDecay } from '@/services/freshness'

const STATUS_ORDER: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected']
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}
const STATUS_COLORS: Record<ApplicationStatus, string> = {
  saved: 'bg-slate-100 text-slate-700',
  applied: 'bg-blue-100 text-blue-700',
  interview: 'bg-amber-100 text-amber-700',
  offer: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}
const COLUMN_COLORS: Record<ApplicationStatus, string> = {
  saved: 'border-slate-200',
  applied: 'border-blue-200',
  interview: 'border-amber-200',
  offer: 'border-emerald-200',
  rejected: 'border-red-200',
}

export default function ApplicationsPage() {
  const featureEnabled = useAppStore((s) => s.features.application_tracker !== false)

  if (!featureEnabled) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <LayoutGrid className="mx-auto h-10 w-10 text-slate-300" />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Application tracker is disabled</h1>
        <p className="mt-1 text-sm text-slate-500">
          The admin has switched this feature off. Check back later.
        </p>
      </div>
    )
  }

  return <ApplicationsBoard />
}

function ApplicationsBoard() {
  const applications = useAppStore((s) => s.applications)
  const addApplication = useAppStore((s) => s.addApplication)
  const updateApplicationStatus = useAppStore((s) => s.updateApplicationStatus)
  const removeApplication = useAppStore((s) => s.removeApplication)
  const resume = useAppStore((s) => s.resume)
  const setResume = useAppStore((s) => s.setResume)
  const apiKeys = useAppStore((s) => s.apiKeys)
  const targetUser = useAppStore((s) => s.targetUser)
  const evidence = useAppStore((s) => s.evidence)
  const confirmedClaims = useAppStore((s) => s.confirmedClaims)
  const patchApplication = useAppStore((s) => s.patchApplication)

  useEffect(() => {
    let cancelled = false
    const isEmptyResume =
      !resume.contact.fullName &&
      !resume.professionalSummary &&
      resume.skills.length === 0 &&
      resume.experience.length === 0 &&
      resume.education.length === 0
    if (isEmptyResume) return
    const apply = async () => {
      for (const app of applications) {
        const hasDna = Boolean(
          app.keywordLedger?.length ||
          app.resumeVariant ||
          app.genuineScore != null ||
          app.atsSnapshot ||
          app.atsScore != null,
        )
        if (hasDna || cancelled) continue
        const { check } = shadowCheck(resume)
        if (cancelled) return
        patchApplication(app.id, { atsScore: check.overall_score, atsSnapshot: check, keywordLedger: [] })
      }
    }
    void apply()
    return () => {
      cancelled = true
    }
  }, [applications, resume, patchApplication])

  const [showForm, setShowForm] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return Boolean(params.get('title') || params.get('url'))
  })
  const [newTitle, setNewTitle] = useState(() => new URLSearchParams(window.location.search).get('title') ?? '')
  const [newCompany, setNewCompany] = useState(() => new URLSearchParams(window.location.search).get('company') ?? '')
  const [newUrl, setNewUrl] = useState(() => new URLSearchParams(window.location.search).get('url') ?? '')

  const total = applications.length
  const interviewCount = applications.filter((a) => a.status === 'interview' || a.status === 'offer').length
  const offerCount = applications.filter((a) => a.status === 'offer').length
  const interviewPct = total > 0 ? Math.round((interviewCount / total) * 100) : 0
  const offerPct = total > 0 ? Math.round((offerCount / total) * 100) : 0
  const patterns = gapPatterns(applications)
  const decayMap = applicationDecay(applications)

  const handleAdd = () => {
    if (!newTitle.trim()) return
    addApplication({
      jobTitle: newTitle.trim(),
      company: newCompany.trim(),
      status: 'saved',
      jobUrl: newUrl.trim(),
      notes: '',
    })
    setNewTitle('')
    setNewCompany('')
    setNewUrl('')
    setShowForm(false)
  }

  const moveForward = (app: ApplicationRecord) => {
    const idx = STATUS_ORDER.indexOf(app.status)
    if (idx < STATUS_ORDER.length - 1) {
      updateApplicationStatus(app.id, STATUS_ORDER[idx + 1])
    }
  }

  const moveBackward = (app: ApplicationRecord) => {
    const idx = STATUS_ORDER.indexOf(app.status)
    if (idx > 0) {
      updateApplicationStatus(app.id, STATUS_ORDER[idx - 1])
    }
  }

  const panelProps = {
    resume,
    setResume,
    apiKeys,
    targetUser,
    patterns,
    evidence,
    confirmedClaims,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-slate-600" />
          <h1 className="text-lg font-semibold text-slate-900">Applications</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" /> Add application
        </button>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
          <StatCard label="Total applications" value={String(total)} />
          <StatCard label="Interview conversion" value={`${interviewPct}%`} />
          <StatCard label="Offer rate" value={`${offerPct}%`} />
        </div>
      )}

      {showForm && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">New application</h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="Job title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="Company"
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="Job URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Briefcase className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-900">No applications yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Track your job applications and manage their status from one place.
          </p>
          <Link
            to="/jobs"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Analyze a job
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {STATUS_ORDER.map((status) => {
            const apps = applications.filter((a) => a.status === status)
            return (
              <div key={status} className={`rounded-xl border-t-4 bg-white shadow-sm ${COLUMN_COLORS[status]}`}>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-xs text-slate-400">{apps.length}</span>
                  </div>
                </div>
                <div className="space-y-2 px-3 pb-3">
                  {apps.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-400">No applications</p>
                  )}
                  {apps.map((app) => (
                    <AppCard
                      key={app.id}
                      app={app}
                      decay={decayMap.get(app.id)}
                      onMarkArchived={() => patchApplication(app.id, { decayed: true })}
                      onForward={() => moveForward(app)}
                      onBackward={() => moveBackward(app)}
                      onDelete={() => removeApplication(app.id)}
                      {...panelProps}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface PanelProps {
  resume: ReturnType<typeof useAppStore.getState>['resume']
  setResume: ReturnType<typeof useAppStore.getState>['setResume']
  apiKeys: ReturnType<typeof useAppStore.getState>['apiKeys']
  targetUser: ReturnType<typeof useAppStore.getState>['targetUser']
  patterns: Array<{ keyword: string; missingCount: number; rejectedWithGap: number }>
  evidence: ReturnType<typeof useAppStore.getState>['evidence']
  confirmedClaims: ReturnType<typeof useAppStore.getState>['confirmedClaims']
}

function AppCard({
  app,
  decay,
  onMarkArchived,
  onForward,
  onBackward,
  onDelete,
  resume,
  setResume,
  apiKeys,
  targetUser,
  patterns,
  evidence,
  confirmedClaims,
}: PanelProps & {
  app: ApplicationRecord
  decay?: ApplicationDecay
  onMarkArchived?: () => void
  onForward: () => void
  onBackward: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [notice, setNotice] = useState('')
  const hasDna = Boolean(
    app.keywordLedger?.length ||
    app.resumeVariant ||
    app.atsScore != null ||
    app.genuineScore != null,
  )
  const ledger = app.keywordLedger ?? []
  const covered = ledger.filter((e) => e.inResume).length
  const gaps = app.keywordGaps ?? ledger.filter((e) => !e.inResume).map((e) => e.keyword)
  const idx = STATUS_ORDER.indexOf(app.status)
  const rejected = app.status === 'rejected'

  const applyMasterSkill = (skill: string) => {
    if (keywordSectionHint(skill) !== 'skills') {
      setNotice(`"${skill}" isn't a straight skill line — attach evidence instead of forcing it onto the skill list.`)
      return
    }
    const exists = resume.skills.some((s) => s.toLowerCase() === skill.toLowerCase())
    if (exists) {
      setNotice(`"${skill}" is already in your master resume.`)
      return
    }
    const next = { ...resume, skills: [...resume.skills, skill] }
    setResume(next)
    setNotice(`Added "${skill}" to your master resume.`)
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{app.jobTitle}</p>
          {app.company && <p className="truncate text-xs text-slate-500">{app.company}</p>}
        </div>
        {hasDna && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            title={expanded ? 'Collapse' : 'Application DNA'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {new Date(app.appliedAt).toLocaleDateString()}
      </p>

      {decay && (
        <div className={`mt-2 rounded-md px-2 py-1.5 text-[11px] ${decay.stage === 'cooldown' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          <span className="font-medium">{decay.stage === 'cooldown' ? 'Cooldown' : 'Archive'}:</span>{' '}
          {decay.reason}
          {decay.stage === 'archive' && onMarkArchived && (
            <button onClick={onMarkArchived} className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-slate-700">
              Mark archived
            </button>
          )}
        </div>
      )}

      {hasDna && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {app.atsScore != null && (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${app.atsScore >= 80 ? 'bg-emerald-100 text-emerald-700' : app.atsScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              <ShieldCheck className="h-3 w-3" /> ATS {app.atsScore}
              {app.atsSnapshot && !app.keywordLedger?.length && app.genuineScore == null && (
                <span className="font-medium text-slate-400">(heuristic)</span>
              )}
            </span>
          )}
          {app.genuineScore != null && (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${app.genuineScore >= 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <Activity className="h-3 w-3" /> Genuine {app.genuineScore}
            </span>
          )}
          {ledger.length > 0 && (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              Keywords {covered}/{ledger.length}
            </span>
          )}
          {gaps.length > 0 && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
              Gaps: {gaps.slice(0, 3).join(', ')}{gaps.length > 3 ? ` +${gaps.length - 3}` : ''}
            </span>
          )}
        </div>
      )}

      {rejected && gaps.length > 0 && (
        <div className="mt-2 rounded-md border border-red-100 bg-red-50/60 px-2 py-1.5">
          <p className="text-[10px] font-semibold text-red-700">What happened + next move</p>
          <button
            onClick={() => setExpanded(true)}
            className="mt-0.5 text-[11px] text-red-600 underline underline-offset-2"
          >
            Review {gaps.length} gap{gaps.length === 1 ? '' : 's'} and act
          </button>
        </div>
      )}

      {notice && (
        <p className="mt-2 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{notice}</p>
      )}

      <div className="mt-2 flex items-center gap-1">
        {idx > 0 && (
          <button onClick={onBackward} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600" title="Move backward">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
        {idx < STATUS_ORDER.length - 1 && (
          <button onClick={onForward} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600" title="Move forward">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={onDelete} className="ml-auto rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && hasDna && (
        <DnaPanel
          app={app}
          ledger={ledger}
          gaps={gaps}
          rejected={rejected}
          resume={resume}
          apiKeys={apiKeys}
          targetUser={targetUser}
          patterns={patterns}
          onAddSkill={applyMasterSkill}
          evidence={evidence}
          confirmedClaims={confirmedClaims}
        />
      )}

      {expanded && !hasDna && (
        <div className="mt-2 rounded-md border border-dashed border-slate-200 px-2 py-2 text-[11px] text-slate-500">
          No DNA recorded for this application. Customize a job and track it from the Jobs page to capture appeal-style coverage, ATS, and Genuine score.
        </div>
      )}
    </div>
  )
}

function DnaPanel({
  app,
  ledger,
  gaps,
  rejected,
  resume,
  apiKeys,
  targetUser,
  patterns,
  onAddSkill,
  evidence,
  confirmedClaims,
}: {
  app: ApplicationRecord
  ledger: KeywordEntry[]
  gaps: string[]
  rejected: boolean
  resume: ReturnType<typeof useAppStore.getState>['resume']
  apiKeys: ReturnType<typeof useAppStore.getState>['apiKeys']
  targetUser: ReturnType<typeof useAppStore.getState>['targetUser']
  patterns: Array<{ keyword: string; missingCount: number; rejectedWithGap: number }>
  onAddSkill: (skill: string) => void
  evidence: ReturnType<typeof useAppStore.getState>['evidence']
  confirmedClaims: ReturnType<typeof useAppStore.getState>['confirmedClaims']
}) {
  const covered = ledger.filter((e) => e.inResume).length
  const pattern = patterns.find((p) => gaps.includes(p.keyword))
  const variant = app.resumeVariant
  const hasGaps = gaps.length > 0

  return (
    <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {app.atsScore != null && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            <ShieldCheck className="h-3 w-3" /> ATS {app.atsScore} at apply
          </span>
        )}
        {app.genuineScore != null && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            <Activity className="h-3 w-3" /> Genuine {app.genuineScore} at apply
          </span>
        )}
        {ledger.length > 0 && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {covered}/{ledger.length} keywords covered
          </span>
        )}
        {variant && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            Variant captured ({variant.contact.fullName || 'unnamed'})
          </span>
        )}
      </div>

      {ledger.length > 0 && (
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="text-[10px] uppercase text-slate-400">
              <th className="py-0.5 font-medium">Keyword</th>
              <th className="py-0.5 font-medium">In resume</th>
              <th className="py-0.5 font-medium">Added by AI</th>
              <th className="py-0.5 font-medium">In vault</th>
              <th className="py-0.5 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => (
              <tr key={`${e.source}-${e.keyword}`} className={e.inResume ? undefined : 'text-red-600'}>
                <td className="py-0.5 font-medium text-slate-800">{e.keyword}</td>
                <td className="py-0.5">{e.inResume ? '✓' : '✗'}</td>
                <td className="py-0.5">{e.addedByCustomization ? '✓' : ''}</td>
                <td className="py-0.5">{e.inVault ? '✓' : ''}</td>
                <td className="py-0.5 capitalize text-slate-500">{e.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rejected && hasGaps && (
        <div className="rounded-md border border-red-100 bg-red-50/50 p-2">
          <p className="text-[11px] font-semibold text-red-700">What happened + next move</p>
          <ul className="mt-1 space-y-1.5">
            {gaps.map((gap) => (
              <li key={gap} className="text-[11px] text-slate-700">
                <span className="font-semibold text-red-600">{gap}</span> — {gapHint(gap)}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {keywordSectionHint(gap) === 'skills' && (
                    <button
                      onClick={() => onAddSkill(gap)}
                      className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-slate-700"
                    >
                      <PackageOpen className="h-3 w-3" /> Add to master
                    </button>
                  )}
                  <Link
                    to="/builder"
                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    <Database className="h-3 w-3" /> Back it with evidence
                  </Link>
                  {apiKeys?.primaryKey && (
                    <PracticeButton
                      resume={resume}
                      app={app}
                      apiKeys={apiKeys}
                      targetUser={targetUser}
                      gap={gap}
                      evidence={evidence}
                      confirmedClaims={confirmedClaims}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
          {pattern && contractText(patterns)}
        </div>
      )}

      {app.jobUrl && (
        <a href={app.jobUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 underline underline-offset-2">
          Open original listing
        </a>
      )}
    </div>
  )
}

function contractText(patterns: Array<{ keyword: string; missingCount: number; rejectedWithGap: number }>) {
  const top = patterns[0]
  if (!top || top.missingCount < 2) return null
  return (
    <p className="mt-1.5 rounded bg-white px-2 py-1 text-[11px] font-medium text-amber-700">
      <Sparkles className="mr-1 inline h-3 w-3" />
      {top.keyword} was missing in {top.missingCount} of your recent applications
      {top.rejectedWithGap > 0 ? ` — including ${top.rejectedWithGap} rejected` : ''}. Worth closing with proof.
    </p>
  )
}

function PracticeButton({
  resume,
  app,
  apiKeys,
  targetUser,
  gap,
  evidence,
  confirmedClaims,
}: {
  resume: ReturnType<typeof useAppStore.getState>['resume']
  app: ApplicationRecord
  apiKeys: NonNullable<ReturnType<typeof useAppStore.getState>['apiKeys']>
  targetUser: ReturnType<typeof useAppStore.getState>['targetUser']
  gap: string
  evidence: ReturnType<typeof useAppStore.getState>['evidence']
  confirmedClaims: ReturnType<typeof useAppStore.getState>['confirmedClaims']
}) {
  const [loading, setLoading] = useState(false)
  const [prep, setPrep] = useState<InterviewPrep | null>(null)
  const [truthSummary, setTruthSummary] = useState<TruthSummary | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await generateInterviewPrep(
        resume,
        { job_title: app.jobTitle, company: app.company },
        { provider: apiKeys.primaryProvider, apiKey: apiKeys.primaryKey, model: apiKeys.primaryModel },
        targetUser ?? undefined,
        [gap],
        evidence,
        confirmedClaims,
      )
      setPrep(result.prep)
      setTruthSummary(result.truthSummary ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prep failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
      >
        <GraduationCap className="h-3 w-3" /> {loading ? 'Preparing…' : prep ? 'Refresh' : 'Practice it'}
      </button>
      {prep && (
        <div className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Gap-focused prep — {gap}</p>
            <button onClick={() => setPrep(null)} className="text-slate-400 hover:text-slate-600" title="Close">
              <X className="h-3 w-3" />
            </button>
          </div>
          {prep.likely_questions?.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-700">
              {prep.likely_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          )}
          {prep.talking_points?.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-700">
              {prep.talking_points.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          )}
          {truthSummary && (
            <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                {truthSummary.proofBacked} backed
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                {truthSummary.inResume} in-resume
              </span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                {truthSummary.needsResearch} research
              </span>
            </div>
          )}
{prep.truth_points && prep.truth_points.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {prep.truth_points.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700">
              <span
                className={`mt-0.5 shrink-0 text-[9px] font-bold uppercase ${
                  p.status === 'proof-backed'
                        ? 'text-emerald-600'
                        : p.status === 'needs-research'
                          ? 'text-amber-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {p.status === 'proof-backed' ? 'backed' : p.status === 'needs-research' ? 'verify' : 'in-resume'}
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}