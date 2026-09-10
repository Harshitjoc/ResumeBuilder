import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, ClipboardList, Briefcase, ShieldCheck, FileText, Loader2, Cloud, CloudOff, ArrowLeft } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import AnalysisPanel from '@/components/reports/AnalysisPanel'
import JobAnalysisCard from '@/components/reports/JobAnalysisCard'
import { getSessionUser, getAnalysisReports } from '@/services/supabase'
import type { ResumeAnalysis } from '@/services/llm'
import type { ReportRecord, ReportKind, JobAnalysis } from '@/types/resume'

const KIND_META: Record<ReportKind, { label: string; chip: string; icon: typeof ClipboardList }> = {
  'resume-analysis': { label: 'Resume analysis', chip: 'bg-violet-100 text-violet-700', icon: ClipboardList },
  'job-analysis': { label: 'Job fit', chip: 'bg-blue-100 text-blue-700', icon: Briefcase },
  verification: { label: 'Verification', chip: 'bg-emerald-100 text-emerald-700', icon: ShieldCheck },
  'resume-snapshot': { label: 'Resume', chip: 'bg-slate-100 text-slate-700', icon: FileText },
}

const FILTERS: Array<{ key: ReportKind | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'resume-analysis', label: 'Resume analysis' },
  { key: 'job-analysis', label: 'Job fit' },
  { key: 'verification', label: 'Verification' },
  { key: 'resume-snapshot', label: 'Resume' },
]

export default function HistoryPage() {
  const reports = useAppStore((s) => s.reports)
  const setReports = useAppStore((s) => s.setReports)
  const setResume = useAppStore((s) => s.setResume)
  const navigate = useNavigate()

  const [filter, setFilter] = useState<ReportKind | 'all'>('all')
  const [selected, setSelected] = useState<ReportRecord | null>(null)
  const [sync, setSync] = useState<'idle' | 'loading' | 'synced' | 'guest'>('idle')

  useEffect(() => {
    let active = true
    getSessionUser().then((user) => {
      if (!active) return
      if (!user) {
        setSync('guest')
        return
      }
      setSync('loading')
      getAnalysisReports(user.id)
        .then((cloud) => {
          if (!active) return
          const merged = mergeReports(useAppStore.getState().reports, cloud)
          setReports(merged)
          setSync('synced')
        })
        .catch(() => {
          if (active) setSync('guest')
        })
    })
    return () => {
      active = false
    }
  }, [setReports])

  const items = useMemo(
    () => (filter === 'all' ? reports : reports.filter((r) => r.kind === filter)),
    [reports, filter],
  )

  const loadIntoBuilder = (report: ReportRecord) => {
    if (!report.resumeSnapshot) return
    setResume(report.resumeSnapshot)
    navigate('/builder')
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to history
        </button>
        <ReportDetail report={selected} onLoad={loadIntoBuilder} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-slate-600" />
          <h1 className="text-lg font-semibold text-slate-900">History &amp; Reports</h1>
        </div>
        <SyncStatus sync={sync} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? reports.length : reports.filter((r) => r.kind === f.key).length
          return (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key)
                setSelected(null)
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                filter === f.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <History className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-900">No reports yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Import and analyze a resume, or run a job-fit analysis — every result is saved here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
          {items.map((report) => (
            <ReportRow key={report.id} report={report} onOpen={() => setSelected(report)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function SyncStatus({ sync }: { sync: 'idle' | 'loading' | 'synced' | 'guest' }) {
  if (sync === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...
      </span>
    )
  }
  if (sync === 'synced') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
        <Cloud className="h-3.5 w-3.5" /> Synced to cloud
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <CloudOff className="h-3.5 w-3.5" /> Sign in to sync across devices
    </span>
  )
}

function ReportRow({ report, onOpen }: { report: ReportRecord; onOpen: () => void }) {
  const meta = KIND_META[report.kind]
  const Icon = meta.icon
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.chip}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{report.title}</span>
          <span className="text-xs text-slate-500">
            {meta.label} · {new Date(report.createdAt).toLocaleString()}
          </span>
        </span>
        {typeof report.score === 'number' && (
          <span
            className={`rounded-full px-2.5 py-1 text-sm font-bold ${
              report.score >= 60 ? 'bg-emerald-100 text-emerald-700' : report.score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {report.score}
          </span>
        )}
      </button>
    </li>
  )
}

function ReportDetail({ report, onLoad }: { report: ReportRecord; onLoad: (r: ReportRecord) => void }) {
  const meta = KIND_META[report.kind]
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
              <meta.icon className="h-3.5 w-3.5" /> {meta.label}
            </span>
            <h1 className="mt-2 text-lg font-semibold text-slate-900">{report.title}</h1>
            <p className="text-sm text-slate-500">{new Date(report.createdAt).toLocaleString()}</p>
          </div>
          {report.resumeSnapshot && (
            <button
              onClick={() => onLoad(report)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Load into resume builder
            </button>
          )}
        </div>
      </div>

      <DetailBody report={report} />
    </div>
  )
}

function DetailBody({ report }: { report: ReportRecord }) {
  if (report.kind === 'resume-analysis') {
    return <AnalysisPanel analysis={(report.payload as unknown as ResumeAnalysis) ?? ({} as ResumeAnalysis)} />
  }
  if (report.kind === 'job-analysis') {
    return <JobAnalysisCard analysis={(report.payload as unknown as JobAnalysis) ?? ({} as JobAnalysis)} />
  }
  if (report.kind === 'verification') {
    return <VerificationDetail payload={report.payload} />
  }
  return <ResumeSnapshotDetail report={report} />
}

function VerificationDetail({ payload }: { payload: unknown }) {
  const changes = Array.isArray(payload) ? (payload as Array<Record<string, string>>) : []
  return (
    <div className="space-y-4">
      {changes.map((c, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
              {c.section} · {(c.changeType ?? '').replace(/_/g, ' ')}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_CLS[c.action] ?? 'bg-slate-100 text-slate-700'}`}>
              {c.action}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-red-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Original</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{c.original || <em className="text-slate-400">(added / new)</em>}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">Customized</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{c.customized || <em className="text-slate-400">(removed)</em>}</p>
            </div>
          </div>
          {c.reason && (
            <p className="mt-3 text-sm text-slate-500">
              <strong className="text-slate-700">Why:</strong> {c.reason}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

const ACTION_CLS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  edited: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
}

function ResumeSnapshotDetail({ report }: { report: ReportRecord }) {
  const r = report.resumeSnapshot
  if (!r) return <p className="text-sm text-slate-500">No snapshot saved for this report.</p>
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Contact</h3>
          <p className="text-sm text-slate-700">{r.contact.fullName || '—'}</p>
          <p className="text-sm text-slate-500">
            {[r.contact.email, r.contact.phone, r.contact.linkedin, r.contact.github, r.contact.website]
              .filter(Boolean)
              .join(' · ') || 'No contact details'}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Skills</h3>
          <div className="flex flex-wrap gap-1.5">
            {r.skills.length === 0
              ? <p className="text-sm text-slate-400">—</p>
              : r.skills.map((s, i) => (
                  <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {s}
                  </span>
                ))}
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Experience" value={String(r.experience.length)} />
        <Stat label="Education" value={String(r.education.length)} />
        <Stat label="Projects" value={String(r.projects.length)} />
      </div>
      {r.professionalSummary && (
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">{r.professionalSummary}</p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <div className="text-xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function mergeReports(local: ReportRecord[], cloud: ReportRecord[]): ReportRecord[] {
  const knownCloud = new Set(local.map((r) => r.cloudId).filter(Boolean) as string[])
  const extra = cloud.filter((r) => r.cloudId && !knownCloud.has(r.cloudId))
  return [...extra, ...local].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}