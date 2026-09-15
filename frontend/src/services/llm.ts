import { getClientKey, getUserId } from '@/services/clientKey'
import { getAccessToken } from '@/services/supabase'
import { useAppStore } from '@/store/appStore'
import type {
  ResumeData,
  JobAnalysis,
  TargetUser,
  AtsCheck,
  InterviewPrep,
  CoverLetterResult,
  ParseResumeResult,
  EvidenceItem,
  VerifiabilityResult,
  KeywordEntry,
  TruthSummary,
} from '@/types/resume'

const BASE = import.meta.env.VITE_API_URL || ''

function extractDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const detail = parsed.detail
      if (typeof detail === 'string') return detail
      if (detail && typeof detail.detail === 'string') return detail.detail
    }
    return raw
  } catch {
    return raw
  }
}

function isQuotaPath(path: string): boolean {
  return path.startsWith('/api/llm') || path.startsWith('/api/ats') || path.startsWith('/api/jobs')
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers || {})
  headers.set('X-Client-Key', getClientKey())
  const userId = getUserId()
  if (userId) headers.set('X-User-Id', userId)
  if (!headers.has('Authorization')) {
    const token = await getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const message = extractDetail(text) || `Request failed: ${res.status}`
    if (res.status === 429) {
      useAppStore.getState().setQuotaExceeded(true)
    } else if (isQuotaPath(path)) {
      useAppStore.getState().decrementQuota()
    }
    throw new Error(message)
  }
  if (isQuotaPath(path)) {
    useAppStore.getState().decrementQuota()
  }
  return res.json() as Promise<T>
}

function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return request<T>(path, { method: 'POST', headers, body: JSON.stringify(body ?? {}) })
}

function get<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return request<T>(path, { method: 'GET', headers })
}

export interface MeResponse {
  plan: 'free' | 'pro'
  planExpiresAt: string | null
  quotaRemaining: number | null
  quotaLimit: number | null
  quotaUnlimited: boolean
  clientKey: string
  user_id: string
  is_anonymous: boolean
  role: string | null
  features?: Record<string, boolean>
}

export interface PaymentMeta {
  upiId: string
  payeeName: string
  amount: number
  currency: string
  mode: string
  subscriptionMonths: number
}

export interface PaymentRequestItem {
  id: string
  clientKey: string | null
  userId: string | null
  name: string | null
  email: string | null
  utr: string
  amount: number | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export interface CreateShareResult {
  slug: string
  name: string
  atsScore: number | null
  evidence: EvidenceItem[]
  createdAt: string
  heuristicAts?: boolean | null
}

export interface PublicShareData {
  name: string
  createdAt: string
  atsScore: number | null
  resume: ResumeData
  evidence: EvidenceItem[]
  heuristicAts?: boolean | null
  ref?: string | null
}

export interface JobEntity {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  result?: unknown
  error?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}

export async function getMe(): Promise<MeResponse> {
  return get('/api/me')
}

export async function deleteAccount(): Promise<{ ok: boolean }> {
  return post('/api/account/delete', {})
}

export async function getPaymentMeta(): Promise<PaymentMeta> {
  return get('/api/payments/meta')
}

export async function createPaymentRequest(
  utr: string,
  opts?: { email?: string; name?: string },
): Promise<{ ok: boolean; requestId: string; status: string }> {
  const body: Record<string, unknown> = { utr }
  if (opts?.email) body.email = opts.email
  if (opts?.name) body.name = opts.name
  return post('/api/payments/request', body)
}

export async function listPaymentRequests(adminToken: string): Promise<{ requests: PaymentRequestItem[] }> {
  return get('/api/payments/requests', adminToken)
}

export async function myPaymentRequests(): Promise<{ requests: PaymentRequestItem[] }> {
  return get('/api/payments/requests/mine')
}

export async function approvePaymentRequest(
  id: string,
  adminToken: string,
): Promise<{ ok: boolean; plan: string; expiresAt: string }> {
  return post(`/api/payments/requests/${id}/approve`, {}, adminToken)
}

export async function rejectPaymentRequest(
  id: string,
  adminToken: string,
): Promise<{ ok: boolean; status: string }> {
  return post(`/api/payments/requests/${id}/reject`, {}, adminToken)
}

export async function createShare(data: {
  name: string
  atsScore?: number | null
  resume: ResumeData
  evidence?: EvidenceItem[]
  heuristicAts?: boolean | null
  ref?: string | null
}): Promise<CreateShareResult> {
  return post('/api/shares', data)
}

export async function fetchShare(slug: string): Promise<PublicShareData> {
  const res = await fetch(`${BASE}/api/shares/${encodeURIComponent(slug)}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Share link not found')
    const err = await res.text().catch(() => '')
    throw new Error(extractDetail(err) || `Share fetch failed: ${res.status}`)
  }
  return res.json() as Promise<PublicShareData>
}

export async function atsFileCheck(
  file: File,
  job: Record<string, unknown> | null,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<{ check: AtsCheck; text: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('job', JSON.stringify(job ?? {}))
  form.append('apiKeys', JSON.stringify(apiKeys))
  form.append('targetUser', JSON.stringify(targetUser ?? null))
  const headers: Record<string, string> = {}
  return request('/api/ats/file', { method: 'POST', headers, body: form })
}

export async function submitJob(
  kind: 'customize' | 'ats-file',
  payload: Record<string, unknown>,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
): Promise<{ jobId: string }> {
  return post('/api/jobs', { kind, payload, apiKeys, targetUser })
}

export async function getJob(jobId: string): Promise<JobEntity> {
  return get(`/api/jobs/${encodeURIComponent(jobId)}`)
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
  evidence?: EvidenceItem[],
): Promise<{
  customizations: Array<Record<string, unknown>>
  customization_summary?: string
  ready_for_verification?: boolean
  verifiability?: VerifiabilityResult
}> {
  return post('/api/llm/customize-resume', {
    resume,
    job: jobParsed,
    compatibility,
    apiKeys,
    targetUser,
    evidence,
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
  evidence?: EvidenceItem[],
): Promise<{ analysis: ResumeAnalysis; verifiability?: VerifiabilityResult }> {
  return post('/api/llm/analyze-resume', { resume, apiKeys, targetUser, evidence })
}

export async function extractResumeText(file: File): Promise<{ text: string }> {
  const form = new FormData()
  form.append('file', file)
  const headers: Record<string, string> = {}
  return request('/api/upload/extract', { method: 'POST', headers, body: form })
}

export async function atsCheck(
  resume: ResumeData,
  job: Record<string, unknown> | null,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
  evidence?: EvidenceItem[],
): Promise<{ check: AtsCheck; verifiability?: VerifiabilityResult }> {
  return post('/api/llm/ats-check', { resume, job, apiKeys, targetUser, evidence })
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
  focusKeywords?: string[],
  evidence?: EvidenceItem[],
  confirmedClaims?: Array<{ id: string; text: string; verdict: string; evidenceId?: string }>,
): Promise<{ prep: InterviewPrep; truthSummary?: TruthSummary }> {
  return post('/api/llm/generate-interview-prep', {
    resume,
    job,
    apiKeys,
    targetUser,
    focusKeywords,
    evidence,
    confirmedClaims,
  })
}

export async function atsShadowCheck(
  resume: ResumeData,
  job?: JobAnalysis | Record<string, unknown> | null,
): Promise<{ check: AtsCheck; keywordLedger: KeywordEntry[]; heuristic: boolean }> {
  return post('/api/ats/shadow', { resume, job: job ?? null })
}

export async function redesignResume(
  resume: Record<string, unknown>,
  job: Record<string, unknown>,
  compatibility: Record<string, unknown>,
  apiKeys: Record<string, string>,
  targetUser?: TargetUser,
  evidence?: EvidenceItem[],
): Promise<{
  customizations?: Array<Record<string, unknown>>
  customization_summary?: string
  verifiability?: VerifiabilityResult
}> {
  return post('/api/llm/redesign-resume', {
    resume,
    job,
    compatibility,
    apiKeys,
    targetUser,
    evidence,
  })
}