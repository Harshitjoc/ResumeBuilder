import type {
  ResumeData,
  JobAnalysis,
  TargetUser,
  AtsCheck,
  InterviewPrep,
  CoverLetterResult,
  ParseResumeResult,
} from '@/types/resume'

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
  targetUser?: TargetUser,
): Promise<{ summary: string }> {
  return post('/api/llm/generate-summary', { resume, apiKeys, targetUser })
}

export async function parseJobDescription(
  jobText: string,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<{ parsed: Record<string, unknown> }> {
  return post('/api/llm/parse-job', { jobText, apiKeys, targetUser })
}

export async function analyzeCompatibility(
  resume: ResumeData,
  jobParsed: Record<string, unknown>,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<{ analysis: JobAnalysis }> {
  return post('/api/llm/analyze-compatibility', {
    resume,
    job: jobParsed,
    apiKeys,
    targetUser,
  })
}

export async function customizeResume(
  resume: ResumeData,
  jobParsed: Record<string, unknown>,
  compatibility: JobAnalysis,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
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
    targetUser,
  })
}

export async function parseResume(
  resumeText: string,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<ParseResumeResult> {
  return post('/api/llm/parse-resume', { resumeText, apiKeys, targetUser })
}

export interface ResumeAnalysis {
  overall_score: number
  sections_present: string[]
  missing_sections: string[]
  ats_notes: string[]
  impact_notes: string[]
  strengths: string[]
  suggestions: string[]
}

export async function analyzeResume(
  resume: ResumeData,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<{ analysis: ResumeAnalysis }> {
  return post('/api/llm/analyze-resume', { resume, apiKeys, targetUser })
}

export async function extractResumeText(file: File): Promise<{ text: string }> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${BASE}/api/upload/extract`, {
    method: 'POST',
    body,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Upload failed: ${res.status}`)
  }
  return res.json()
}

export async function atsCheck(
  resume: ResumeData,
  job: Record<string, unknown> | null,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<{ check: AtsCheck }> {
  return post('/api/llm/ats-check', { resume, job, apiKeys, targetUser })
}

export async function generateCoverLetter(
  resume: ResumeData,
  job: Record<string, unknown>,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<CoverLetterResult> {
  return post('/api/llm/generate-cover-letter', { resume, job, apiKeys, targetUser })
}

export async function generateInterviewPrep(
  resume: ResumeData,
  job: Record<string, unknown>,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<{ prep: InterviewPrep }> {
  return post('/api/llm/generate-interview-prep', { resume, job, apiKeys, targetUser })
}
