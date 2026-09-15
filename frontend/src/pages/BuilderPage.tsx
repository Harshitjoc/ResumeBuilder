import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Check, Cloud, ClipboardCheck, Share2, Database, Loader2, Eraser, Copy, MessageCircle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { ResumeData, Experience, Education, Project, Certification, SavedTemplate, TemplateId, AtsCheck } from '@/types/resume'
import ResumePreview from '@/components/ResumePreview'
import AtsPanel from '@/components/reports/AtsPanel'
import Gate, { QuotaNotice } from '@/components/Gate'
import { TEMPLATE_IDS, TEMPLATE_META } from '@/components/templates'
import { atsCheck, createShare } from '@/services/llm'
import { shadowCheck } from '@/services/shadowAts'
import { evidenceFreshness } from '@/services/freshness'
import { saveResume, getSessionUser } from '@/services/supabase'

const apiKeysToRecord = (apiKeys: NonNullable<ReturnType<typeof useAppStore.getState>['apiKeys']>) => ({
  provider: apiKeys.primaryProvider,
  apiKey: apiKeys.primaryKey,
  model: apiKeys.primaryModel,
})

function ConfirmResetModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3 className="text-base font-semibold text-slate-900">Clear your workspace?</h3>
        <p className="mt-2 text-sm text-slate-500">
          This erases everything on this device — resume fields, evidence, applications, reports, and shares. Cloud-synced
          data will be restored from your account on the next sync. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Clear all
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BuilderPage() {
  const resume = useAppStore((s) => s.resume)
  const apiKeys = useAppStore((s) => s.apiKeys)
  const targetUser = useAppStore((s) => s.targetUser)
  const evidence = useAppStore((s) => s.evidence)
  const removeEvidence = useAppStore((s) => s.removeEvidence)
  const addShare = useAppStore((s) => s.addShare)
  const resetWorkspace = useAppStore((s) => s.resetWorkspace)
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsResult, setAtsResult] = useState<AtsCheck | null>(null)
  const [atsError, setAtsError] = useState('')
  const heuristicScore = useMemo(() => {
    const isEmpty =
      !resume.contact.fullName &&
      !resume.professionalSummary &&
      resume.skills.length === 0 &&
      resume.experience.length === 0 &&
      resume.education.length === 0
    if (isEmpty) return null
    return shadowCheck(resume).check
  }, [resume])
  const [shareCopied, setShareCopied] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [copiedEvidenceId, setCopiedEvidenceId] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const waUrl = useMemo(() => {
    if (!shareUrl) return ''
    const hasLlmScore = Boolean(atsResult?.overall_score)
    const text = `My verified resume${hasLlmScore ? ` (ATS ${atsResult!.overall_score})` : ' — ATS offline estimate'}: ${shareUrl}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }, [shareUrl, atsResult])

  const handleSaveToCloud = useCallback(async () => {
    const user = await getSessionUser()
    if (!user) return
    setCloudStatus('saving')
    try {
      await saveResume(resume, user.id)
      setCloudStatus('saved')
      setTimeout(() => setCloudStatus('idle'), 2000)
    } catch {
      setCloudStatus('error')
      setTimeout(() => setCloudStatus('idle'), 2000)
    }
  }, [resume])

  useEffect(() => {
    const t = setTimeout(() => {
      getSessionUser().then((u) => {
        if (u) {
          saveResume(resume, u.id).catch(() => {})
        }
      })
    }, 1500)
    return () => clearTimeout(t)
  }, [resume])

  const handleAtsCheck = async () => {
    if (!apiKeys) return
    setAtsLoading(true)
    setAtsError('')
    setAtsResult(null)
    try {
      const result = await atsCheck(resume, null, apiKeysToRecord(apiKeys), targetUser ?? undefined, evidence)
      setAtsResult(result.check)
    } catch (e) {
      setAtsError(e instanceof Error ? e.message : 'ATS check failed')
    } finally {
      setAtsLoading(false)
    }
  }

  const handleShare = async () => {
    setShareLoading(true)
    setShareError('')
    try {
      const created = await createShare({
        name: resume.contact.fullName || 'Resume',
        atsScore: atsResult?.overall_score ?? null,
        resume,
        evidence,
        heuristicAts: atsResult ? undefined : true,
        ref: localStorage.getItem('rb-referrer') ?? undefined,
      })
      addShare({
        slug: created.slug,
        name: created.name,
        resume,
        atsScore: created.atsScore,
        evidence: created.evidence ?? evidence,
      })
      const url = `${window.location.origin}/share/${created.slug}`
      await navigator.clipboard.writeText(url)
      setShareUrl(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Could not create share link')
    } finally {
      setShareLoading(false)
    }
  }

  const { stale: staleIds, aging: agingIds } = evidenceFreshness(evidence)

  return (
    <div className="space-y-4">
      {showClearConfirm && (
        <ConfirmResetModal
          onConfirm={() => { resetWorkspace(); setShowClearConfirm(false) }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-slate-900">Resume Builder</h1>
          {heuristicScore && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                heuristicScore.overall_score >= 70
                  ? 'bg-emerald-50 text-emerald-700'
                  : heuristicScore.overall_score >= 45
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
              }`}
              title="Deterministic offline estimate — run a full ATS check for the LLM-assisted score"
            >
              <ClipboardCheck className="h-3 w-3" /> ATS {heuristicScore.overall_score} · heuristic
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Eraser className="h-4 w-4" />
            Clear all
          </button>
          <Gate inline reason="ATS checks are a Pro feature.">
            <button
              onClick={handleAtsCheck}
              disabled={!apiKeys || atsLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              {atsLoading ? 'Checking...' : 'Run ATS check'}
            </button>
          </Gate>
          <Gate inline reason="Hosted share links are a Pro feature.">
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {shareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {shareLoading ? 'Creating...' : shareCopied ? 'Copied!' : 'Share resume'}
            </button>
          </Gate>
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          <button
            onClick={handleSaveToCloud}
            disabled={cloudStatus === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Cloud className="h-4 w-4" />
            {cloudStatus === 'saving' ? 'Saving...' : 'Save to cloud'}
          </button>
          {cloudStatus === 'saved' && <span className="text-sm text-green-600">Saved</span>}
          {cloudStatus === 'error' && <span className="text-sm text-red-600">Error saving</span>}
        </div>
      </div>

      {atsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{atsError}</div>
      )}

      {shareError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{shareError}</div>
      )}

      <QuotaNotice />

      {atsResult && <AtsPanel check={atsResult} />}

      {evidence.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-5 w-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Evidence vault</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {evidence.length} item{evidence.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="space-y-2">
            {evidence.map((item) => {
              const fresh = staleIds.includes(item.id) ? ('stale' as const) : agingIds.includes(item.id) ? ('aging' as const) : ('fresh' as const)
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                    item.confidence === 'medium' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {item.category}
                  </span>
                  <span className={`min-w-0 flex-1 text-slate-700 ${fresh === 'stale' ? 'opacity-70' : ''}`}>{item.text}</span>
                  {fresh !== 'fresh' && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        fresh === 'stale' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                      }`}
                      title={item.createdAt ? `Added ${new Date(item.createdAt).toLocaleDateString()}` : undefined}
                    >
                      {fresh === 'stale' ? 'stale proof · add a recent update' : 'aging proof · worth refreshing'}
                    </span>
                  )}
                  {fresh === 'stale' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.text).catch(() => {})
                        setCopiedEvidenceId(item.id)
                        setTimeout(() => setCopiedEvidenceId(''), 1500)
                      }}
                      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800"
                      title="Copy claim text for a newer evidence draft"
                    >
                      <Copy className="h-3 w-3" /> {copiedEvidenceId === item.id ? 'Copied' : 'Copy as newer draft'}
                    </button>
                  )}
                  <button onClick={() => removeEvidence(item.id)} className="shrink-0 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <ResumeForm />
        <PreviewPanel />
      </div>
    </div>
  )
}

function PreviewPanel() {
  const resume = useAppStore((s) => s.resume)
  const navigate = useNavigate()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Live Preview</h2>
        <button
          onClick={() => navigate('/preview')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Full screen
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {resume.contact.fullName ? (
          <ResumeComp />
        ) : (
          <p className="p-8 text-center text-sm text-slate-400">
            Fill in your details on the left to see a live preview.
          </p>
        )}
      </div>
    </div>
  )
}

function ResumeComp() {
  const resume = useAppStore((s) => s.resume)
  return <ResumePreview resume={resume} />
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  const cls =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {textarea ? (
        <textarea
          className={`${cls} min-h-20`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={cls}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function TemplateThumb({ id }: { id: TemplateId }) {
  const bar = 'h-1.5 rounded-full bg-slate-300'
  const nameBar = 'mx-auto h-2.5 w-2/3 rounded-sm bg-slate-500'
  if (id === 'modern') {
    return (
      <div className="flex h-full">
        <div className="w-1/3 bg-indigo-500" />
        <div className="flex-1 space-y-2 p-3">
          <div className="mx-auto h-2.5 w-2/3 rounded-sm bg-slate-600" />
          <div className={bar} />
          <div className={`${bar} w-4/5`} />
        </div>
      </div>
    )
  }
  if (id === 'minimal') {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-3">
        <div className="h-2.5 w-2/3 rounded-sm bg-slate-400" />
        <div className={bar} />
        <div className="mx-auto h-1 w-3/4 rounded-full bg-slate-200" />
        <div className="h-1 w-2/3 rounded-full bg-slate-200" />
      </div>
    )
  }
  if (id === 'bold') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-1/2 items-center justify-between space-y-1 bg-slate-900 px-3">
          <div className="h-2.5 w-1/3 rounded-sm bg-slate-200" />
          <div className="h-3 w-3 rounded-sm bg-amber-500" />
        </div>
        <div className="flex-1 space-y-2 p-3">
          <div className={`${bar} w-2/3`} />
          <div className={bar} />
        </div>
      </div>
    )
  }
  if (id === 'professional') {
    return (
      <div className="flex h-full">
        <div className="w-1/3 space-y-2 bg-slate-100 p-3">
          <div className="h-2.5 w-2/3 bg-slate-500" />
          <div className="h-1 w-full rounded-full bg-slate-300" />
          <div className="h-1 w-3/4 rounded-full bg-slate-300" />
        </div>
        <div className="flex-1 space-y-2 p-3">
          <div className={`${bar} w-2/3`} />
          <div className={bar} />
          <div className={`${bar} w-4/5`} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-2 p-4">
      <div className={nameBar} />
      <div className={bar} />
      <div className={`${bar} w-4/5`} />
      <div className="h-0.5 w-2/3 rounded-full bg-slate-200" />
    </div>
  )
}

function ConfirmLoadModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3 className="text-base font-semibold text-slate-900">Use "{name}"?</h3>
        <p className="mt-2 text-sm text-slate-500">
          This replaces your current resume fields with the ones saved in this template. Your current data is not deleted, but
          it will be overwritten on this device.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Use template
          </button>
        </div>
      </div>
    </div>
  )
}

function ResumeForm() {
  const resume = useAppStore((s) => s.resume)
  const setResume = useAppStore((s) => s.setResume)
  const updateContact = useAppStore((s) => s.updateContact)
  const updateSummary = useAppStore((s) => s.updateSummary)
  const updateNotes = useAppStore((s) => s.updateNotes)
  const updateSkills = useAppStore((s) => s.updateSkills)
  const customTemplates = useAppStore((s) => s.customTemplates)
  const removeCustomTemplate = useAppStore((s) => s.removeCustomTemplate)
  const [templateToLoad, setTemplateToLoad] = useState<SavedTemplate | null>(null)

  const update = (patch: Partial<ResumeData>) => setResume({ ...resume, ...patch })
  const updateExperience = (list: Experience[]) => update({ experience: list })
  const updateEducation = (list: Education[]) => update({ education: list })
  const updateProjects = (list: Project[]) => update({ projects: list })
  const updateCerts = (list: Certification[]) => update({ certifications: list })

  return (
    <div className="space-y-6">
      {templateToLoad && (
        <ConfirmLoadModal
          name={templateToLoad.name}
          onConfirm={() => {
            setResume({ ...templateToLoad.resume })
            setTemplateToLoad(null)
          }}
          onCancel={() => setTemplateToLoad(null)}
        />
      )}

      <Card title="Contact Information">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" value={resume.contact.fullName} onChange={(v) => updateContact({ fullName: v })} />
          <Field label="Email" value={resume.contact.email} onChange={(v) => updateContact({ email: v })} />
          <Field label="Phone" value={resume.contact.phone} onChange={(v) => updateContact({ phone: v })} />
          <Field label="LinkedIn" value={resume.contact.linkedin} onChange={(v) => updateContact({ linkedin: v })} />
          <Field label="GitHub" value={resume.contact.github} onChange={(v) => updateContact({ github: v })} />
          <Field label="Website" value={resume.contact.website} onChange={(v) => updateContact({ website: v })} />
        </div>
      </Card>

      <Card title="Professional Summary">
        <Field textarea label="Summary" value={resume.professionalSummary} onChange={updateSummary} placeholder="2-3 sentences about your career..." />
      </Card>

      <Card title="Skills">
        <SkillsEditor value={resume.skills} onChange={updateSkills} />
      </Card>

      <Card title="Template">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TEMPLATE_IDS.map((t) => {
            const meta = TEMPLATE_META.find((m) => m.id === t)
            const selected = resume.template === t
            return (
              <button
                key={t}
                onClick={() => update({ template: t })}
                className={`group overflow-hidden rounded-lg border text-left transition ${
                  selected
                    ? 'border-slate-900 ring-2 ring-slate-900/10'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className={`h-24 bg-white ${selected ? 'bg-slate-50' : ''}`}>
                  <TemplateThumb id={t} />
                </div>
                <div className={`flex items-center justify-between border-t px-3 py-2 ${selected ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                  <span className={`text-sm font-medium ${selected ? 'text-white' : 'text-slate-800'}`}>
                    {meta?.label ?? t}
                  </span>
                  {selected && <Check className="h-4 w-4 text-white" />}
                </div>
                <p className="hidden bg-white px-3 pb-2 text-xs text-slate-500 sm:block">
                  {selected ? meta?.description : meta?.description}
                </p>
              </button>
            )
          })}
        </div>

        {customTemplates.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">My templates</h3>
            <p className="mt-0.5 text-xs text-slate-500">Saved from your imports — applies the style and content.</p>
            <ul className="mt-3 space-y-2">
              {customTemplates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setTemplateToLoad(t)}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => removeCustomTemplate(t.id)}
                      aria-label={`Delete ${t.name}`}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Work Experience">
        {resume.experience.length === 0 && <EmptyState label="No experience yet" />}
        {resume.experience.map((exp) => (
          <ExperienceEditor key={exp.id} exp={exp} onChange={(updated) => updateExperience(resume.experience.map((e) => (e.id === updated.id ? updated : e)))} onRemove={() => updateExperience(resume.experience.filter((e) => e.id !== exp.id))} />
        ))}
        <AddButton label="Add experience" onClick={() => updateExperience([...resume.experience, newExperience()])} />
      </Card>

      <Card title="Education">
        {resume.education.length === 0 && <EmptyState label="No education yet" />}
        {resume.education.map((edu) => (
          <EducationEditor key={edu.id} edu={edu} onChange={(updated) => updateEducation(resume.education.map((e) => (e.id === updated.id ? updated : e)))} onRemove={() => updateEducation(resume.education.filter((e) => e.id !== edu.id))} />
        ))}
        <AddButton label="Add education" onClick={() => updateEducation([...resume.education, newEducation()])} />
      </Card>

      <Card title="Projects">
        {resume.projects.length === 0 && <EmptyState label="No projects yet" />}
        {resume.projects.map((proj) => (
          <ProjectEditor key={proj.id} proj={proj} onChange={(updated) => updateProjects(resume.projects.map((p) => (p.id === updated.id ? updated : p)))} onRemove={() => updateProjects(resume.projects.filter((p) => p.id !== proj.id))} />
        ))}
        <AddButton label="Add project" onClick={() => updateProjects([...resume.projects, newProject()])} />
      </Card>

      <Card title="Certifications">
        {resume.certifications.length === 0 && <EmptyState label="No certifications yet" />}
        {resume.certifications.map((cert) => (
          <CertEditor key={cert.id} cert={cert} onChange={(updated) => updateCerts(resume.certifications.map((c) => (c.id === updated.id ? updated : c)))} onRemove={() => updateCerts(resume.certifications.filter((c) => c.id !== cert.id))} />
        ))}
        <AddButton label="Add certification" onClick={() => updateCerts([...resume.certifications, newCert()])} />
      </Card>

      <Card title="Notes">
        <Field
          textarea
          label="Additional notes"
          value={resume.notes}
          onChange={updateNotes}
          placeholder="Awards, honors, languages, volunteer work, or anything else you want to include..."
        />
      </Card>
    </div>
  )
}

function SkillsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  return (
    <Field
      label="Skills (comma separated)"
      value={text}
      onChange={(v) => {
        setText(v)
        onChange(v.split(',').map((s) => s.trim()).filter(Boolean))
      }}
    />
  )
}

function ExperienceEditor({ exp, onChange, onRemove }: { exp: Experience; onChange: (e: Experience) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job title" value={exp.jobTitle} onChange={(v) => onChange({ ...exp, jobTitle: v })} />
        <Field label="Company" value={exp.company} onChange={(v) => onChange({ ...exp, company: v })} />
        <Field label="Start date" value={exp.startDate} onChange={(v) => onChange({ ...exp, startDate: v })} />
        <Field label="End date" value={exp.endDate} onChange={(v) => onChange({ ...exp, endDate: v })} />
      </div>
      <div className="mt-3">
        <BulletsEditor bullets={exp.bullets} onChange={(bullets) => onChange({ ...exp, bullets })} />
      </div>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </div>
  )
}

function BulletsEditor({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Achievements / bullet points</label>
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            value={b}
            onChange={(e) => onChange(bullets.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button onClick={() => onChange(bullets.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...bullets, ''])}
        className="text-sm font-medium text-slate-600 hover:text-slate-800"
      >
        + Add bullet
      </button>
    </div>
  )
}

function EducationEditor({ edu, onChange, onRemove }: { edu: Education; onChange: (e: Education) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Degree" value={edu.degree} onChange={(v) => onChange({ ...edu, degree: v })} />
        <Field label="School" value={edu.school} onChange={(v) => onChange({ ...edu, school: v })} />
        <Field label="End date" value={edu.endDate} onChange={(v) => onChange({ ...edu, endDate: v })} />
        <Field label="GPA (optional)" value={edu.gpa || ''} onChange={(v) => onChange({ ...edu, gpa: v })} />
      </div>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </div>
  )
}

function ProjectEditor({ proj, onChange, onRemove }: { proj: Project; onChange: (p: Project) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project name" value={proj.name} onChange={(v) => onChange({ ...proj, name: v })} />
        <Field label="Link" value={proj.link} onChange={(v) => onChange({ ...proj, link: v })} />
      </div>
      <div className="mt-3">
        <Field label="Technologies (comma separated)" value={proj.technologies.join(', ')} onChange={(v) => onChange({ ...proj, technologies: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </div>
      <div className="mt-3">
        <Field textarea label="Description" value={proj.description} onChange={(v) => onChange({ ...proj, description: v })} />
      </div>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </div>
  )
}

function CertEditor({ cert, onChange, onRemove }: { cert: Certification; onChange: (c: Certification) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Name" value={cert.name} onChange={(v) => onChange({ ...cert, name: v })} />
        <Field label="Issuer" value={cert.issuer} onChange={(v) => onChange({ ...cert, issuer: v })} />
        <Field label="Date" value={cert.date} onChange={(v) => onChange({ ...cert, date: v })} />
      </div>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
      <Plus className="h-4 w-4" /> {label}
    </button>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm italic text-slate-400">{label}</p>
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}
const newExperience = (): Experience => ({ id: uid(), jobTitle: '', company: '', startDate: '', endDate: '', bullets: [''] })
const newEducation = (): Education => ({ id: uid(), degree: '', school: '', endDate: '', gpa: '' })
const newProject = (): Project => ({ id: uid(), name: '', description: '', link: '', technologies: [] })
const newCert = (): Certification => ({ id: uid(), name: '', issuer: '', date: '' })
