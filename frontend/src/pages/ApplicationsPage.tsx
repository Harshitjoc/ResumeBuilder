import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Plus, Trash2, ChevronRight, ChevronLeft, Briefcase } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { ApplicationStatus, ApplicationRecord } from '@/types/resume'

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
  const applications = useAppStore((s) => s.applications)
  const addApplication = useAppStore((s) => s.addApplication)
  const updateApplicationStatus = useAppStore((s) => s.updateApplicationStatus)
  const removeApplication = useAppStore((s) => s.removeApplication)

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
                      onForward={() => moveForward(app)}
                      onBackward={() => moveBackward(app)}
                      onDelete={() => removeApplication(app.id)}
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

function AppCard({
  app,
  onForward,
  onBackward,
  onDelete,
}: {
  app: ApplicationRecord
  onForward: () => void
  onBackward: () => void
  onDelete: () => void
}) {
  const idx = STATUS_ORDER.indexOf(app.status)
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900 truncate">{app.jobTitle}</p>
      {app.company && <p className="text-xs text-slate-500 truncate">{app.company}</p>}
      <p className="mt-1 text-xs text-slate-400">
        {new Date(app.appliedAt).toLocaleDateString()}
      </p>
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
