import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Sparkles, Loader2, Check, Wand2, Database, ClipboardCheck } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ApiKeyManager from '@/components/ApiKeyManager'
import AnalysisPanel from '@/components/reports/AnalysisPanel'
import { parseResume, analyzeResume, extractResumeText, type ResumeAnalysis } from '@/services/llm'
import { shadowCheck } from '@/services/shadowAts'
import { saveAnalysisReport, getSessionUser } from '@/services/supabase'
import { normalizeTemplate } from '@/components/templates'
import GenuineScoreCard from '@/components/GenuineScoreCard'
import type { ResumeData, Experience, Education, Project, Certification, ReportRecord, EvidenceItem, VerifiabilityResult } from '@/types/resume'

const apiKeysToRecord = (apiKeys: NonNullable<ReturnType<typeof useAppStore.getState>['apiKeys']>) => ({
  provider: apiKeys.primaryProvider,
  apiKey: apiKeys.primaryKey,
  model: apiKeys.primaryModel,
})

export default function ImportPage() {
  const resume = useAppStore((s) => s.resume)
  const apiKeys = useAppStore((s) => s.apiKeys)
  const targetUser = useAppStore((s) => s.targetUser)
  const setResume = useAppStore((s) => s.setResume)
  const addReport = useAppStore((s) => s.addReport)
  const setReportCloudId = useAppStore((s) => s.setReportCloudId)
  const addEvidence = useAppStore((s) => s.addEvidence)
  const addCustomTemplate = useAppStore((s) => s.addCustomTemplate)
  const navigate = useNavigate()

  const [resumeText, setResumeText] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState<'extract' | 'parse' | 'analyze' | null>(null)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ResumeData | null>(null)
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [verifiability, setVerifiability] = useState<VerifiabilityResult | null>(null)
  const [templateNameOpen, setTemplateNameOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateSaved, setTemplateSaved] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const hasKeys = Boolean(apiKeys?.primaryKey)
  const editable = parsed
  const analysisSource = parsed ?? (resume.contact.fullName || resume.skills.length || resume.experience.length ? resume : null)
  const heuristic = useMemo(() => {
    if (!editable) return null
    const { check } = shadowCheck(editable)
    return check
  }, [editable])

  const persistReport = async (report: ReportRecord) => {
    const user = await getSessionUser()
    if (!user) return
    saveAnalysisReport(report, user.id)
      .then((cloudId) => setReportCloudId(report.id, cloudId))
      .catch(() => {})
  }

  const handleFile = async (f: File | undefined) => {
    if (!f) return
    setError('')
    setLoading('extract')
    try {
      const { text } = await extractResumeText(f)
      setResumeText(text)
      setFileName(f.name)
      setParsed(null)
      setAnalysis(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not extract text from the file')
    } finally {
      setLoading(null)
    }
  }

  const handleParse = async () => {
    if (!apiKeys || !resumeText.trim()) return
    setError('')
    setLoading('parse')
    try {
      const result = await parseResume(resumeText, apiKeysToRecord(apiKeys), targetUser ?? undefined)
      setParsed(normalizeParsed(result.parsed))
      const ev = Array.isArray(result.evidence) ? result.evidence : []
      setEvidenceCount(ev.length)
      setEvidenceItems(ev)
      setAnalysis(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parsing failed')
    } finally {
      setLoading(null)
    }
  }

  const handleAnalyze = async () => {
    if (!apiKeys) return
    if (!analysisSource) return
    setError('')
    setLoading('analyze')
    try {
      const result = await analyzeResume(analysisSource, apiKeysToRecord(apiKeys), targetUser ?? undefined, evidenceItems)
      setAnalysis(result.analysis)
      if (result.verifiability) setVerifiability(result.verifiability)
      const report = addReport({
        kind: 'resume-analysis',
        title: `${analysisSource.contact.fullName || 'Resume'} analysis — ${new Date().toLocaleDateString()}`,
        score: typeof result.analysis.overall_score === 'number' ? result.analysis.overall_score : null,
        payload: result.analysis,
        resumeSnapshot: analysisSource,
      })
      persistReport(report)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(null)
    }
  }

  const handleLoadIntoBuilder = () => {
    if (!parsed) return
    setResume(parsed)
    for (const item of evidenceItems) {
      addEvidence({ category: item.category, text: item.text, confidence: item.confidence, source: 'document' })
    }
    const report = addReport({
      kind: 'resume-snapshot',
      title: `${parsed.contact.fullName || 'Imported resume'} — loaded ${new Date().toLocaleDateString()}`,
      score: null,
      payload: null,
      resumeSnapshot: parsed,
    })
    persistReport(report)
    setLoaded(true)
    setTimeout(() => navigate('/builder'), 700)
  }

  const handleSaveAsTemplate = () => {
    if (!editable) return
    addCustomTemplate({
      name: templateName.trim() || `${editable.contact.fullName || 'Imported resume'} template`,
      resume: editable,
    })
    setTemplateName('')
    setTemplateNameOpen(false)
    setTemplateSaved(true)
    setTimeout(() => setTemplateSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <ApiKeyManager />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Upload className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900">Import an existing resume</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={loading !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading === 'extract' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {loading === 'extract' ? 'Extracting text...' : 'Upload PDF / DOCX / TXT'}
            </button>
            <span className="text-sm text-slate-500">
              {fileName ? `File: ${fileName}` : 'or paste your resume text below'}
            </span>
          </div>
        </div>

        <textarea
          value={resumeText}
          onChange={(e) => {
            setResumeText(e.target.value)
            setParsed(null)
            setAnalysis(null)
          }}
          placeholder="Paste the full text of your existing resume here..."
          className="mt-4 min-h-64 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleParse}
            disabled={!hasKeys || !resumeText.trim() || loading !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading === 'parse' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {loading === 'parse' ? 'Parsing resume...' : 'Parse my resume'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!hasKeys || !analysisSource || loading !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading === 'analyze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading === 'analyze' ? 'Analyzing...' : 'Analyze my resume'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StepChip n={1} label="Add LLM key" done={hasKeys} next={!hasKeys} />
          <StepChip n={2} label="Parse" done={Boolean(parsed)} next={hasKeys && !parsed && Boolean(resumeText.trim())} />
          <StepChip n={3} label="Analyze" done={Boolean(analysis)} next={hasKeys && Boolean(parsed) && !analysis} />
        </div>
        {!hasKeys && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Add your LLM key in the panel above and click <strong>Save key</strong> to enable parsing and analysis.
          </div>
        )}
        {hasKeys && resumeText.trim() && !parsed && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Text extracted — click <strong>Parse my resume</strong> to structure it, then <strong>Analyze my resume</strong> unlocks.
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {analysis && (
        <AnalysisPanel analysis={analysis} />
      )}

      {verifiability && (
        <GenuineScoreCard verifiability={verifiability} />
      )}

      {parsed && evidenceCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <Database className="h-4 w-4" />
          Found <strong>{evidenceCount}</strong> claim{evidenceCount === 1 ? '' : 's'} — verified from document
        </div>
      )}

      {editable && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Is this correct?</h2>
            <div className="flex items-center gap-2">
              {heuristic && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    heuristic.overall_score >= 70
                      ? 'bg-emerald-50 text-emerald-700'
                      : heuristic.overall_score >= 45
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700'
                  }`}
                  title="Deterministic offline estimate — labelled heuristic and never tuned by the LLM"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" /> ATS {heuristic.overall_score} · heuristic
                </span>
              )}
              <p className="text-sm text-slate-500">Review and edit what the AI extracted, then load it into the builder.</p>
            </div>
          </div>
          <ParsedEditor value={editable} onChange={setParsed} />
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleLoadIntoBuilder}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {loaded ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              {loaded ? 'Loading...' : 'Load into resume builder'}
            </button>
            <div className="flex items-center gap-2">
              {templateSaved ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  <Check className="h-4 w-4" /> Saved to My templates
                </span>
              ) : templateNameOpen ? (
                <>
                  <input
                    autoFocus
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveAsTemplate()}
                    placeholder="Template name"
                    className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveAsTemplate}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setTemplateNameOpen(false)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setTemplateNameOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Check className="h-4 w-4" />
                  Save as custom template
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function normalizeParsed(raw: Partial<ResumeData>): ResumeData {
  const contact = {
    fullName: '',
    email: '',
    phone: '',
    linkedin: '',
    github: '',
    website: '',
    ...(raw.contact ?? {}),
  }
  const exp = (raw.experience ?? []).map((e) => ({
    id: uid(),
    jobTitle: e.jobTitle ?? '',
    company: e.company ?? '',
    startDate: e.startDate ?? '',
    endDate: e.endDate ?? '',
    bullets: Array.isArray(e.bullets) ? e.bullets.map(String) : [],
  }))
  const edu = (raw.education ?? []).map((e) => ({
    id: uid(),
    degree: e.degree ?? '',
    school: e.school ?? '',
    endDate: e.endDate ?? '',
    gpa: e.gpa ?? '',
  }))
  const projects = (raw.projects ?? []).map((p) => ({
    id: uid(),
    name: p.name ?? '',
    description: p.description ?? '',
    link: p.link ?? '',
    technologies: Array.isArray(p.technologies) ? p.technologies.map(String) : [],
  }))
  const certs = (raw.certifications ?? []).map((c) => ({
    id: uid(),
    name: c.name ?? '',
    issuer: c.issuer ?? '',
    date: c.date ?? '',
  }))
  return {
    contact,
    professionalSummary: raw.professionalSummary ?? '',
    skills: Array.isArray(raw.skills) ? raw.skills.map(String) : [],
    experience: exp,
    education: edu,
    projects,
    certifications: certs,
    notes: raw.notes ?? '',
    template: normalizeTemplate(raw.template),
  }
}

function ParsedEditor({ value, onChange }: { value: ResumeData; onChange: (r: ResumeData) => void }) {
  const set = (patch: Partial<ResumeData>) => onChange({ ...value, ...patch })
  const setContact = (patch: Partial<ResumeData['contact']>) => onChange({ ...value, contact: { ...value.contact, ...patch } })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name" value={value.contact.fullName} onChange={(v) => setContact({ fullName: v })} />
        <Field label="Email" value={value.contact.email} onChange={(v) => setContact({ email: v })} />
        <Field label="Phone" value={value.contact.phone} onChange={(v) => setContact({ phone: v })} />
        <Field label="LinkedIn" value={value.contact.linkedin} onChange={(v) => setContact({ linkedin: v })} />
        <Field label="GitHub" value={value.contact.github} onChange={(v) => setContact({ github: v })} />
        <Field label="Website" value={value.contact.website} onChange={(v) => setContact({ website: v })} />
      </div>

      <Field label="Professional summary" textarea value={value.professionalSummary} onChange={(v) => set({ professionalSummary: v })} />
      <Field
        label="Notes (awards, languages, volunteer work, etc.)"
        textarea
        value={value.notes}
        onChange={(v) => set({ notes: v })}
      />
      <Field
        label="Skills (comma separated)"
        value={value.skills.join(', ')}
        onChange={(v) => set({ skills: v.split(',').map((s) => s.trim()).filter(Boolean) })}
      />

      <ListItem<Experience>
        title="Work experience"
        empty="No experience found"
        items={value.experience}
        addLabel="Add experience"
        onAdd={() => set({ experience: [...value.experience, { id: uid(), jobTitle: '', company: '', startDate: '', endDate: '', bullets: [''] }] })}
        onRemove={(id) => set({ experience: value.experience.filter((e) => e.id !== id) })}
        onChange={(id, patch) => set({ experience: value.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) })}
        render={(item, patch) => (
          <ExpRow item={item} onChange={patch} />
        )}
      />

      <ListItem<Education>
        title="Education"
        empty="No education found"
        items={value.education}
        addLabel="Add education"
        onAdd={() => set({ education: [...value.education, { id: uid(), degree: '', school: '', endDate: '', gpa: '' }] })}
        onRemove={(id) => set({ education: value.education.filter((e) => e.id !== id) })}
        onChange={(id, patch) => set({ education: value.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) })}
        render={(item, patch) => (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Degree" value={item.degree} onChange={(v) => patch({ degree: v })} />
            <Field label="School" value={item.school} onChange={(v) => patch({ school: v })} />
            <Field label="End date" value={item.endDate} onChange={(v) => patch({ endDate: v })} />
            <Field label="GPA" value={item.gpa ?? ''} onChange={(v) => patch({ gpa: v })} />
          </div>
        )}
      />

      <ListItem<Project>
        title="Projects"
        empty="No projects found"
        items={value.projects}
        addLabel="Add project"
        onAdd={() => set({ projects: [...value.projects, { id: uid(), name: '', description: '', link: '', technologies: [] }] })}
        onRemove={(id) => set({ projects: value.projects.filter((e) => e.id !== id) })}
        onChange={(id, patch) => set({ projects: value.projects.map((e) => (e.id === id ? { ...e, ...patch } : e)) })}
        render={(item, patch) => (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name" value={item.name} onChange={(v) => patch({ name: v })} />
              <Field label="Link" value={item.link} onChange={(v) => patch({ link: v })} />
            </div>
            <Field label="Technologies (comma separated)" value={item.technologies.join(', ')} onChange={(v) => patch({ technologies: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </div>
        )}
      />

      <ListItem<Certification>
        title="Certifications"
        empty="No certifications found"
        items={value.certifications}
        addLabel="Add certification"
        onAdd={() => set({ certifications: [...value.certifications, { id: uid(), name: '', issuer: '', date: '' }] })}
        onRemove={(id) => set({ certifications: value.certifications.filter((e) => e.id !== id) })}
        onChange={(id, patch) => set({ certifications: value.certifications.map((e) => (e.id === id ? { ...e, ...patch } : e)) })}
        render={(item, patch) => (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Name" value={item.name} onChange={(v) => patch({ name: v })} />
            <Field label="Issuer" value={item.issuer} onChange={(v) => patch({ issuer: v })} />
            <Field label="Date" value={item.date} onChange={(v) => patch({ date: v })} />
          </div>
        )}
      />
    </div>
  )
}

function ListItem<T extends { id: string }>({
  title,
  empty,
  items,
  addLabel,
  onAdd,
  onRemove,
  onChange,
  render,
}: {
  title: string
  empty: string
  items: T[]
  addLabel: string
  onAdd: () => void
  onRemove: (id: string) => void
  onChange: (id: string, patch: Partial<T>) => void
  render: (item: T, patch: (p: Partial<T>) => void) => React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      {items.length === 0 && <p className="text-sm italic text-slate-400">{empty}</p>}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            {render(item, (p) => onChange(item.id, p))}
            <button onClick={() => onRemove(item.id)} className="mt-3 text-xs font-medium text-red-600 hover:text-red-700">
              Remove
            </button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        + {addLabel}
      </button>
    </div>
  )
}

function ExpRow({ item, onChange }: { item: Experience; onChange: (p: Partial<Experience>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job title" value={item.jobTitle} onChange={(v) => onChange({ jobTitle: v })} />
        <Field label="Company" value={item.company} onChange={(v) => onChange({ company: v })} />
        <Field label="Start date" value={item.startDate} onChange={(v) => onChange({ startDate: v })} />
        <Field label="End date" value={item.endDate} onChange={(v) => onChange({ endDate: v })} />
      </div>
      {item.bullets.map((b, i) => (
        <Field
          key={i}
          label={i === 0 ? 'Key responsibilities / achievements' : ''}
          value={b}
          onChange={(v) => onChange({ bullets: item.bullets.map((x, j) => (j === i ? v : x)) })}
        />
      ))}
    </div>
  )
}

function StepChip({ n, label, done, next }: { n: number; label: string; done: boolean; next: boolean }) {
  const cls = done
    ? 'bg-emerald-100 text-emerald-700'
    : next
      ? 'bg-slate-900 text-white'
      : 'bg-slate-100 text-slate-400'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
          done ? 'bg-emerald-600 text-white' : next ? 'bg-white/30 text-white' : 'bg-slate-300 text-slate-500'
        }`}
      >
        {done ? '✓' : n}
      </span>
      {label}
    </span>
  )
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
        <textarea className={`${cls} min-h-16`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}