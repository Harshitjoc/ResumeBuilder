import type { ResumeData, JobAnalysis } from '@/types/resume'

const BASE = import.meta.env.VITE_API_URL || ''

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function generateSummary(
  resume: ResumeData,
  apiKeys: Record<string, string>,
): Promise<{ summary: string }> {
  return post('/api/llm/generate-summary', { resume, apiKeys })
}

export async function parseJobDescription(
  jobText: string,
  apiKeys: Record<string, string>,
): Promise<{ parsed: Record<string, unknown> }> {
  return post('/api/llm/parse-job', { jobText, apiKeys })
}

export async function analyzeCompatibility(
  resume: ResumeData,
  jobParsed: Record<string, unknown>,
  apiKeys: Record<string, string>,
): Promise<{ analysis: JobAnalysis }> {
  return post('/api/llm/analyze-compatibility', {
    resume,
    job: jobParsed,
    apiKeys,
  })
}

export async function customizeResume(
  resume: ResumeData,
  jobParsed: Record<string, unknown>,
  compatibility: JobAnalysis,
  apiKeys: Record<string, string>,
): Promise<{
  customizations: Array<Record<string, unknown>>
  customization_summary?: string
  ready_for_verification?: boolean
}> {
  return post('/api/llm/customize-resume', {
    resume,
    job: jobParsed,
    compatibility,
    apiKeys,
  })
}
