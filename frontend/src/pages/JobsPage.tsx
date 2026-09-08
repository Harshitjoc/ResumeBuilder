import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, Check } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ApiKeyManager from '@/components/ApiKeyManager'
import { parseJobDescription, analyzeCompatibility, customizeResume } from '@/services/llm'
import type { JobAnalysis, VerificationChange } from '@/types/resume'

const apiKeysToRecord = (apiKeys: NonNullable<ReturnType<typeof useAppStore.getState>['apiKeys']>) => ({
  provider: apiKeys.primaryProvider,
  apiKey: apiKeys.primaryKey,
  model: apiKeys.primaryModel,
})

export default function JobsPage() {
  const resume = useAppStore((s) => s.resume)
  const apiKeys = useAppStore((s) => s.apiKeys)
  const jobPosting = useAppStore((s) => s.jobPosting)
  const setJobPosting = useAppStore((s) => s.setJobPosting)
  const setCompatibilityScore = useAppStore((s) => s.setCompatibilityScore)
  const setPendingChanges = useAppStore((s) => s.setPendingChanges)
  const navigate = useNavigate()

  const [loading, setLoading] = useState<'parse' | 'compat' | 'customize' | null>(null)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null)
  const [parsedJob, setParsedJob] = useState<Record<string, unknown> | null>(null)

  const hasKeys = Boolean(apiKeys?.primaryKey)

  const handleParse = async () => {
    if (!apiKeys) return
    setError('')
    setLoading('parse')
    try {
      const { parsed } = await parseJobDescription(jobPosting, apiKeysToRecord(apiKeys))
      setParsedJob(parsed)

      const { analysis } = await analyzeCompatibility(resume, parsed, apiKeysToRecord(apiKeys))
      setAnalysis(analysis)
      setCompatibilityScore(analysis.compatibilityScore)
      setLoading('compat')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(null)
    }
  }

  const handleCustomize = async () => {
    if (!apiKeys || !analysis || !parsedJob) return
    setError('')
    setLoading('customize')
    try {
      const result = await customizeResume(resume, parsedJob, analysis, apiKeysToRecord(apiKeys))
      const changes: VerificationChange[] = (result.customizations ?? []).map(
        (c: any, i: number) => ({
          id: `c${i}`,
          section: c.section,
          changeType: c.change_type,
          original: c.original ?? '',
          customized: c.customized ?? '',
          reason: c.reason ?? '',
          severity: c.change_severity ?? 'low',
          action: 'pending',
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
          {!hasKeys && <p className="text-sm text-slate-400">Add your LLM key above to analyze.</p>}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {analysis && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {analysis.jobTitle || 'Job'}
                {analysis.company && <span className="text-slate-500"> at {analysis.company}</span>}
              </h2>
              <p className="text-sm text-slate-500">
                {analysis.roleType} · {analysis.seniorityLevel}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ScoreBadge label="Compatibility" value={analysis.compatibilityScore} />
              <ScoreBadge label="Skill match" value={analysis.skillMatchPercentage} />
            </div>
          </div>

          <p className={`mt-3 text-sm font-medium ${analysis.compatibilityScore >= 60 ? 'text-green-700' : 'text-amber-700'}`}>
            Recommendation: {analysis.recommendation}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <InfoList title="Required skills" items={analysis.requiredSkills} />
            <InfoList title="Your strengths" items={analysis.skillStrengths} />
            <InfoList title="Skill gaps" items={analysis.skillGaps} />
          </div>

          {analysis.concerns.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Concerns:</strong> {analysis.concerns.join(' ')}
            </div>
          )}

          <div className="mt-5">
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
          </div>
        </section>
      )}
    </div>
  )
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 60 ? 'text-green-700' : value >= 40 ? 'text-amber-700' : 'text-red-700'
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-slate-700">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">—</p>
      ) : (
        <ul className="space-y-0.5 text-sm text-slate-600">
          {items.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Check className="h-3 w-3 shrink-0 text-slate-400" /> {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
