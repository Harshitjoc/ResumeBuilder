import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, Cloud, FileText, Target, ClipboardCheck, LayoutGrid, Copy, Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ApiKeyManager from '@/components/ApiKeyManager'
import JobAnalysisCard from '@/components/reports/JobAnalysisCard'
import AtsPanel from '@/components/reports/AtsPanel'
import Gate, { QuotaNotice } from '@/components/Gate'
import FitWarningModal from '@/components/FitWarningModal'
import { parseJobDescription, analyzeCompatibility, customizeResume, redesignResume, generateCoverLetter, generateInterviewPrep, atsCheck, submitJob, getJob } from '@/services/llm'
import { buildApplicationDna } from '@/services/applicationDna'
import { shadowCheck } from '@/services/shadowAts'
import type { JobAnalysis, VerificationChange, AtsCheck, InterviewPrep, TruthSummary } from '@/types/resume'
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
  const compatibilityScore = useAppStore((s) => s.compatibilityScore)
  const setCompatibilityScore = useAppStore((s) => s.setCompatibilityScore)
  const setPendingChanges = useAppStore((s) => s.setPendingChanges)
  const addReport = useAppStore((s) => s.addReport)
  const setReportCloudId = useAppStore((s) => s.setReportCloudId)
  const addApplication = useAppStore((s) => s.addApplication)
  const evidence = useAppStore((s) => s.evidence)
  const setPendingVariant = useAppStore((s) => s.setPendingVariant)
  const pendingVariant = useAppStore((s) => s.pendingVariant)
  const confirmedClaims = useAppStore((s) => s.confirmedClaims)
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
  const [truthSummary, setTruthSummary] = useState<TruthSummary | null>(null)
  const [prepLoading, setPrepLoading] = useState(false)

  const [atsResult, setAtsResult] = useState<AtsCheck | null>(null)
  const [atsLoading, setAtsLoading] = useState(false)

  const shadowAts = useMemo(() => {
    if (!parsedJob) return null
    return shadowCheck(resume, parsedJob as JobAnalysis | Record<string, unknown>)
  }, [resume, parsedJob])

  const [customizeJob, setCustomizeJob] = useState<{ id: string; status: string } | null>(null)

  const [showFitWarning, setShowFitWarning] = useState(false)
  const [redesigning, setRedesigning] = useState(false)

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
      const result = await customizeResume(resume, parsedJob, analysis, apiKeysToRecord(apiKeys), targetUser ?? undefined, evidence)
      applyCustomizationResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Customization failed')
    } finally {
      setLoading(null)
    }
  }

  const applyCustomizationResult = (result: {
    customizations?: Array<Record<string, unknown>>
    customization_summary?: string
  }) => {
    const changes: VerificationChange[] = (result.customizations ?? []).map(
      (c: Record<string, unknown>, i: number) => ({
        id: `c${i}`,
        section: c.section as string,
        changeType: c.change_type as string,
        original: (c.original as string) ?? '',
        customized: (c.customized as string) ?? '',
        reason: (c.reason as string) ?? '',
        severity: (c.change_severity as 'low' | 'medium' | 'high') ?? 'low',
        action: (c.action as VerificationChange['action']) === 'blocked'
          ? ('blocked' as const)
          : ('pending' as const),
        confidence: (c.confidence as 'high' | 'medium' | 'low' | undefined) ?? undefined,
        isAuthentic: (c.is_authentic as boolean | undefined) ?? undefined,
        verdict: (c.action as VerificationChange['action']) === 'blocked'
          ? ('unverifiable' as const)
          : undefined,
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
    setPendingVariant({ resume, baseResume: resume, analysis: analysis ?? undefined, ats: atsResult ?? undefined })
    navigate('/verify')
  }

  const pollJob = (jobId: string) => {
    getJob(jobId)
      .then((job) => {
        if (job.status === 'done') {
          setCustomizeJob(null)
          const result = (job.result ?? {}) as {
            customizations?: Array<Record<string, unknown>>
            customization_summary?: string
          }
          applyCustomizationResult(result)
        } else if (job.status === 'error') {
          setCustomizeJob(null)
          setError(job.error ?? 'Background customization failed')
        } else {
          setCustomizeJob({ id: jobId, status: job.status })
          setTimeout(() => pollJob(jobId), 2000)
        }
      })
      .catch((e) => {
        setCustomizeJob(null)
        setError(e instanceof Error ? e.message : 'Background job failed')
      })
  }

  const handleCustomizeBackground = async () => {
    if (!apiKeys || !analysis || !parsedJob) return
    setError('')
    try {
      const { jobId } = await submitJob(
        'customize',
        { resume, job: parsedJob, compatibility: analysis, evidence },
        apiKeysToRecord(apiKeys),
        targetUser ?? undefined,
      )
      setCustomizeJob({ id: jobId, status: 'queued' })
      pollJob(jobId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start background job')
    }
  }

  const handleCustomizeClick = () => {
    if (compatibilityScore !== null && compatibilityScore < 40) {
      setShowFitWarning(true)
    } else {
      handleCustomize()
    }
  }

  const handleRedesign = async () => {
    if (!analysis) return
    setRedesigning(true)
    setError('')
    try {
      const result = await redesignResume(
        resume as unknown as Record<string, unknown>,
        parsedJob!,
        { overall_score: compatibilityScore, ...analysis } as Record<string, unknown>,
        apiKeysToRecord(apiKeys!),
        targetUser ?? undefined,
        evidence,
      )
      applyCustomizationResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Redesign failed')
    } finally {
      setRedesigning(false)
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
      const result = await generateInterviewPrep(resume, parsedJob, apiKeysToRecord(apiKeys), targetUser ?? undefined, undefined, evidence, confirmedClaims)
      setInterviewPrep(result.prep)
      setTruthSummary(result.truthSummary ?? null)
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
      const result = await atsCheck(resume, parsedJob, apiKeysToRecord(apiKeys), targetUser ?? undefined, evidence)
      setAtsResult(result.check)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ATS check failed')
    } finally {
      setAtsLoading(false)
    }
  }

  const handleTrackApplication = () => {
    const source = { resume, baseResume: resume, analysis, ats: atsResult ?? undefined }
    const variant = pendingVariant?.resume ?? source.resume
    const dna = buildApplicationDna({
      resume: variant,
      baseResume: pendingVariant?.baseResume ?? source.baseResume,
      analysis: pendingVariant?.analysis ?? source.analysis ?? undefined,
      ats: pendingVariant?.ats ?? source.ats,
      evidence,
      confirmedClaims,
    })
    addApplication({
      jobTitle: analysis?.jobTitle || (parsedJob?.job_title as string) || '',
      company: analysis?.company || (parsedJob?.company as string) || '',
      status: 'applied',
      jobUrl: '',
      notes: '',
      ...dna,
      jobSource: 'customize',
    })
    setPendingVariant(undefined)
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

      <QuotaNotice />

      {showFitWarning && (
        <FitWarningModal
          score={compatibilityScore ?? 0}
          recommendation={analysis?.recommendation}
          concerns={analysis?.concerns}
          onConfirm={() => {
            setShowFitWarning(false)
            handleCustomize()
          }}
          onDismiss={() => setShowFitWarning(false)}
        />
      )}

      {analysis && (
        <>
          <JobAnalysisCard analysis={analysis} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCustomizeClick}
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
            {customizeJob ? (
              <span className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {customizeJob.status === 'running' ? 'Customizing in background...' : 'Job queued...'}
              </span>
            ) : (
              <Gate inline reason="Background jobs are a Pro feature.">
                <button
                  onClick={handleCustomizeBackground}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Customize in background
                </button>
              </Gate>
            )}
            <Gate inline reason="Resume redesign is a Pro feature — it restructures your resume for ATS pass-through.">
              <button
                onClick={handleRedesign}
                disabled={redesigning}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {redesigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Redesign for this job
              </button>
            </Gate>
            <Gate inline reason="Cover letters are a Pro feature.">
              <button
                onClick={handleCoverLetter}
                disabled={coverLoading || !parsedJob}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {coverLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate cover letter
              </button>
            </Gate>
            <Gate inline reason="Interview prep is a Pro feature.">
              <button
                onClick={handleInterviewPrep}
                disabled={prepLoading || !parsedJob}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {prepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                Interview prep
              </button>
            </Gate>
            <Gate inline reason="ATS checks are a Pro feature.">
              <button
                onClick={handleAtsCheck}
                disabled={atsLoading || !parsedJob}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {atsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Run ATS check
              </button>
            </Gate>
            <Gate inline reason="The application tracker is a Pro feature.">
              <button
                onClick={handleTrackApplication}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <LayoutGrid className="h-4 w-4" />
                Track application
              </button>
            </Gate>
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
          {truthSummary && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> {truthSummary.proofBacked} proof-backed
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                {truthSummary.inResume} claims in resume
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                {truthSummary.needsResearch} need research
              </span>
            </div>
          )}
          {Array.isArray(interviewPrep.truth_points) && interviewPrep.truth_points.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Linked to your resume — what you can back up
              </p>
              <ul className="space-y-1.5">
                {interviewPrep.truth_points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <span
                      className={`mt-0.5 shrink-0 text-[11px] font-bold uppercase tracking-wide ${
                        p.status === 'proof-backed'
                          ? 'text-emerald-600'
                          : p.status === 'needs-research'
                            ? 'text-amber-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {p.status === 'proof-backed' ? 'backed' : p.status === 'needs-research' ? 'verify' : 'in-resume'}
                    </span>
                    <span className="text-sm text-slate-700">{p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {atsResult && <AtsPanel check={atsResult} />}

      {shadowAts && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Offline ATS estimate</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
                shadowAts.check.overall_score >= 70
                  ? 'bg-emerald-50 text-emerald-700'
                  : shadowAts.check.overall_score >= 45
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
              }`}
            >
              <ClipboardCheck className="h-4 w-4" /> {shadowAts.check.overall_score}
              <span className="text-xs font-medium opacity-70">heuristic</span>
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Deterministic, offline estimate computed locally — never uses your API key. The gated <strong>Run ATS check</strong> button runs a full LLM-tailored ATS review (Pro), which often scores differently because it reads context, not just terms.
          </p>
          {shadowAts.keywordLedger.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Required terms not found in your resume</p>
              <div className="flex flex-wrap gap-1.5">
                {shadowAts.keywordLedger.map((k, i) => (
                  <span key={i} className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                    {k.keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
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
