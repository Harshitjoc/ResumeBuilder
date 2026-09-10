import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, Cloud, FileText, Target, ClipboardCheck, LayoutGrid, Copy, Download } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ApiKeyManager from '@/components/ApiKeyManager'
import JobAnalysisCard from '@/components/reports/JobAnalysisCard'
import AtsPanel from '@/components/reports/AtsPanel'
import { parseJobDescription, analyzeCompatibility, customizeResume, generateCoverLetter, generateInterviewPrep, atsCheck } from '@/services/llm'
import type { JobAnalysis, VerificationChange, AtsCheck, InterviewPrep } from '@/types/resume'
import { saveJobPosting, saveAnalysisReport, getSessionUser } from '@/services/supabase'

const apiKeysToRecord = (apiKeys: NonNullable<ReturnType<typeof useAppStore.getState>['apiKeys']>) => ({
  provider: apiKeys.primaryProvider,
  apiKey: apiKeys.primaryKey,
  model: apiKeys.primaryModel,
})

export default function JobsPage() {
  const resume = useAppStore((s) => s.resume)
  const apiKeys = useAppStore((s) => s.apiKeys)
  const targetUser = useAppStore((s) => s.targetUser)
  const jobPosting = useAppStore((s) => s.jobPosting)
  const setJobPosting = useAppStore((s) => s.setJobPosting)
  const setCompatibilityScore = useAppStore((s) => s.setCompatibilityScore)
  const setPendingChanges = useAppStore((s) => s.setPendingChanges)
  const addReport = useAppStore((s) => s.addReport)
  const setReportCloudId = useAppStore((s) => s.setReportCloudId)
  const addApplication = useAppStore((s) => s.addApplication)
  const navigate = useNavigate()

  const [loading, setLoading] = useState<'parse' | 'compat' | 'customize' | null>(null)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null)
  const [parsedJob, setParsedJob] = useState<Record<string, unknown> | null>(null)
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [coverLetter, setCoverLetter] = useState<string | null>(null)
  const [coverLoading, setCoverLoading] = useState(false)
  const [coverCopied, setCoverCopied] = useState(false)

  const [interviewPrep, setInterviewPrep] = useState<InterviewPrep | null>(null)
  const [prepLoading, setPrepLoading] = useState(false)

  const [atsResult, setAtsResult] = useState<AtsCheck | null>(null)
  const [atsLoading, setAtsLoading] = useState(false)

  const hasKeys = Boolean(apiKeys?.primaryKey)

  const handleParse = async () => {
    if (!apiKeys) return
    setError('')
    setLoading('parse')
    try {
      const { parsed } = await parseJobDescription(jobPosting, apiKeysToRecord(apiKeys), targetUser ?? undefined)
      setParsedJob(parsed)

      const { analysis } = await analyzeCompatibility(resume, parsed, apiKeysToRecord(apiKeys), targetUser ?? undefined)
      setAnalysis(analysis)
      setCompatibilityScore(analysis.compatibilityScore)
      setLoading('compat')

      const report = addReport({
        kind: 'job-analysis',
        title: `${analysis.jobTitle || 'Job'}${analysis.company ? ` at ${analysis.company}` : ''} — ${new Date().toLocaleDateString()}`,
        score: typeof analysis.compatibilityScore === 'number' ? analysis.compatibilityScore : null,
        payload: analysis,
        resumeSnapshot: resume,
        jobSnapshot: { jobTitle: analysis.jobTitle, company: analysis.company, rawText: jobPosting, parsed },
      })
      const user = await getSessionUser()
      if (user) {
        saveAnalysisReport(report, user.id)
          .then((cloudId) => setReportCloudId(report.id, cloudId))
          .catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(null)
    }
  }

  const handleSaveToCloud = async () => {
    if (!parsedJob || !analysis) return
    const user = await getSessionUser()
    if (!user) return
    setCloudStatus('saving')
    try {
      await saveJobPosting(parsedJob, jobPosting, user.id, analysis.compatibilityScore)
      setCloudStatus('saved')
      setTimeout(() => setCloudStatus('idle'), 2000)
    } catch {
      setCloudStatus('error')
      setTimeout(() => setCloudStatus('idle'), 2000)
    }
  }

  const handleCustomize = async () => {
    if (!apiKeys || !analysis || !parsedJob) return
    setError('')
    setLoading('customize')
    try {
      const result = await customizeResume(resume, parsedJob, analysis, apiKeysToRecord(apiKeys), targetUser ?? undefined)
      const changes: VerificationChange[] = (result.customizations ?? []).map(
        (c: Record<string, unknown>, i: number) => ({
          id: `c${i}`,
          section: c.section as string,
          changeType: c.change_type as string,
          original: (c.original as string) ?? '',
          customized: (c.customized as string) ?? '',
          reason: (c.reason as string) ?? '',
          severity: (c.change_severity as 'low' | 'medium' | 'high') ?? 'low',
          action: 'pending' as const,
          confidence: (c.confidence as 'high' | 'medium' | 'low' | undefined) ?? undefined,
          isAuthentic: (c.is_authentic as boolean | undefined) ?? undefined,
        }),
      )
      if (changes.length === 0) {
        changes.push({
          id: 'summary',
          section: 'customization',
          changeType: 'ready',
          original: '',
          customized: result.customization_summary ?? 'Resume is ready for the job with no required changes.',
          reason: '',
          severity: 'low',
          action: 'pending',
        })
      }
      setPendingChanges(changes)
      navigate('/verify')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Customization failed')
    } finally {
      setLoading(null)
    }
  }

  const handleCoverLetter = async () => {
    if (!apiKeys || !parsedJob) return
    setError('')
    setCoverLoading(true)
    try {
      const result = await generateCoverLetter(resume, parsedJob, apiKeysToRecord(apiKeys), targetUser ?? undefined)
      setCoverLetter(result.letter)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cover letter generation failed')
    } finally {
      setCoverLoading(false)
    }
  }

  const handleInterviewPrep = async () => {
    if (!apiKeys || !parsedJob) return
    setError('')
    setPrepLoading(true)
    try {
      const result = await generateInterviewPrep(resume, parsedJob, apiKeysToRecord(apiKeys), targetUser ?? undefined)
      setInterviewPrep(result.prep)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Interview prep failed')
    } finally {
      setPrepLoading(false)
    }
  }

  const handleAtsCheck = async () => {
    if (!apiKeys || !parsedJob) return
    setError('')
    setAtsLoading(true)
    try {
      const result = await atsCheck(resume, parsedJob, apiKeysToRecord(apiKeys), targetUser ?? undefined)
      setAtsResult(result.check)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ATS check failed')
    } finally {
      setAtsLoading(false)
    }
  }

  const handleTrackApplication = () => {
    addApplication({
      jobTitle: analysis?.jobTitle || (parsedJob?.job_title as string) || '',
      company: analysis?.company || (parsedJob?.company as string) || '',
      status: 'applied',
      jobUrl: '',
      notes: '',
    })
    navigate('/applications')
  }

  const handleCopyCoverLetter = () => {
    if (!coverLetter) return
    navigator.clipboard.writeText(coverLetter).then(() => {
      setCoverCopied(true)
      setTimeout(() => setCoverCopied(false), 2000)
    }).catch(() => {})
  }

  const handleDownloadCoverLetter = () => {
    if (!coverLetter) return
    const blob = new Blob([coverLetter], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cover-letter-${analysis?.company || 'job'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <ApiKeyManager />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Job description</h2>
        <textarea
          value={jobPosting}
          onChange={(e) => setJobPosting(e.target.value)}
          placeholder="Paste the job description here..."
          className="min-h-40 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleParse}
            disabled={!hasKeys || !jobPosting || loading !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading === 'compat' ? 'Analyzing compatibility...' : loading ? 'Parsing job...' : 'Analyze job'}
          </button>
        </div>
        {!hasKeys && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Add your LLM key in the panel above and click <strong>Save key</strong> to enable job analysis.
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {analysis && (
        <>
          <JobAnalysisCard analysis={analysis} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCustomize}
              disabled={loading !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading === 'customize' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Customize resume for this job
            </button>
            <button
              onClick={handleCoverLetter}
              disabled={coverLoading || !parsedJob}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {coverLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate cover letter
            </button>
            <button
              onClick={handleInterviewPrep}
              disabled={prepLoading || !parsedJob}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {prepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
              Interview prep
            </button>
            <button
              onClick={handleAtsCheck}
              disabled={atsLoading || !parsedJob}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {atsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Run ATS check
            </button>
            <button
              onClick={handleTrackApplication}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LayoutGrid className="h-4 w-4" />
              Track application
            </button>
            <button
              onClick={handleSaveToCloud}
              disabled={cloudStatus === 'saving'}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Cloud className="h-4 w-4" />
              {cloudStatus === 'saving' ? 'Saving...' : 'Save to cloud'}
            </button>
            {cloudStatus === 'saved' && <span className="text-sm text-green-600">Saved</span>}
            {cloudStatus === 'error' && <span className="text-sm text-red-600">Error saving</span>}
          </div>
        </>
      )}

      {coverLetter && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Cover Letter</h2>
            <div className="flex gap-2">
              <button onClick={handleCopyCoverLetter} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                {coverCopied ? <Copy className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {coverCopied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleDownloadCoverLetter} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Download className="h-3.5 w-3.5" />
                Download .txt
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">{coverLetter}</pre>
        </section>
      )}

      {interviewPrep && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Interview Prep</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <NoteList title="Likely questions" items={interviewPrep.likely_questions} />
            <NoteList title="Company research" items={interviewPrep.company_research} />
            <NoteList title="Talking points" items={interviewPrep.talking_points} />
            <NoteList title="Questions to ask" items={interviewPrep.questions_to_ask} />
          </div>
        </section>
      )}

      {atsResult && <AtsPanel check={atsResult} />}
    </div>
  )
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  const safe = Array.isArray(items) ? items : []
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-700">{title}</p>
      {safe.length === 0 ? (
        <p className="text-sm text-slate-400">—</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
          {safe.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
