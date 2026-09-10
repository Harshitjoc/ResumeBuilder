import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import type { ResumeData, VerificationChange, ReportRecord, ReportKind } from '@/types/resume'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export const isSupabaseConfigured = Boolean(supabase)

export interface AppUser {
  id: string
  email: string | undefined
  app_metadata: Record<string, unknown>
  user_metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function signUpEmail(email: string, password: string, fullName?: string) {
  if (!supabase) return { data: null, error: { message: 'Supabase not configured' } as any }
  return supabase.auth.signUp({
    email,
    password,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  })
}

export async function signInPassword(email: string, password: string) {
  if (!supabase)
    return { data: { user: null, session: null }, error: { message: 'Supabase not configured' } as any }
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signInAnonymously() {
  if (!supabase) return { data: null, error: { message: 'Supabase not configured' } as any }
  return supabase.auth.signInAnonymously()
}

export async function signOut(scope?: 'global' | 'local' | 'others') {
  if (!supabase) return { error: null }
  return supabase.auth.signOut(scope ? { scope } : undefined)
}

export async function updatePassword(newPassword: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

export async function getSession() {
  if (!supabase) return { data: { session: null }, error: { message: 'Supabase not configured' } as any }
  return supabase.auth.getSession()
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function linkEmailToAccount(
  email: string,
  password: string,
  fullName?: string,
) {
  if (!supabase)
    return { data: { user: null }, error: { message: 'Supabase not configured' } as any }
  return supabase.auth.updateUser({
    email,
    password,
    data: fullName ? { full_name: fullName } : undefined,
  })
}

export async function claimAnonymousRows(anonToken: string): Promise<Record<string, unknown>> {
  const token = await getAccessToken()
  if (!token) throw new Error('Not signed in')
  const base = import.meta.env.VITE_API_URL || ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  const res = await fetch(`${base}/api/auth/claim-anonymous`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ anon_token: anonToken }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const parsed = JSON.parse(text)
      const detail = parsed?.detail
      message = typeof detail === 'string' ? detail : detail?.detail ?? text
    } catch {
      /* keep raw text */
    }
    throw new Error(message || `Claim failed: ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } }
  return supabase.auth.onAuthStateChange(callback as any)
}

export async function getSessionUser(): Promise<AppUser | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user as AppUser | null
}

// ---------------------------------------------------------------------------
// Profile helpers (plan entitlement + persona)
// ---------------------------------------------------------------------------

export interface ProfileRecord {
  plan: 'free' | 'pro'
  planExpiresAt: string | null
  targetUser: string | null
}

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, target_user')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    plan: data.plan === 'pro' ? 'pro' : 'free',
    planExpiresAt: data.plan_expires_at ? String(data.plan_expires_at) : null,
    targetUser: data.target_user ? String(data.target_user) : null,
  }
}

export async function upsertProfile(
  userId: string,
  patch: { plan?: 'free' | 'pro'; targetUser?: string | null },
): Promise<void> {
  if (!supabase) return
  const row: Record<string, unknown> = { id: userId }
  if (patch.plan) row.plan = patch.plan
  if (patch.targetUser !== undefined) row.target_user = patch.targetUser
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`Failed to update profile: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Resume helpers
// ---------------------------------------------------------------------------

export async function saveResume(resume: ResumeData, userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('resumes')
    .upsert(
      {
        user_id: userId,
        content: resume as unknown as Record<string, unknown>,
        template_format: resume.template,
        is_master: true,
      },
      { onConflict: 'id' },
    )
  if (error) throw new Error(`Failed to save resume: ${error.message}`)
}

export async function getResumes(userId: string): Promise<ResumeData[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('resumes')
    .select('content')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(`Failed to load resumes: ${error.message}`)
  return (data ?? []).map((row) => row.content as ResumeData)
}

// ---------------------------------------------------------------------------
// Job posting helpers
// ---------------------------------------------------------------------------

export async function saveJobPosting(
  parsedData: Record<string, unknown>,
  rawText: string,
  userId: string,
  compatibilityScore?: number,
): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('job_postings').insert({
    user_id: userId,
    parsed_data: parsedData,
    raw_text: rawText,
    compatibility_score: compatibilityScore ?? null,
  })
  if (error) throw new Error(`Failed to save job posting: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Analysis / report history
// ---------------------------------------------------------------------------

export async function saveAnalysisReport(report: ReportRecord, userId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('analysis_reports')
    .insert({
      user_id: userId,
      kind: report.kind,
      title: report.title,
      score: report.score,
      payload: (report.payload ?? null) as unknown as Record<string, unknown> | null,
      resume_snapshot: (report.resumeSnapshot ?? null) as unknown as Record<string, unknown> | null,
      job_snapshot: (report.jobSnapshot ?? null) as unknown as Record<string, unknown> | null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to save report: ${error.message}`)
  return data.id as string
}

export async function getAnalysisReports(userId: string): Promise<ReportRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('analysis_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to load reports: ${error.message}`)
  const rows = data as Array<Record<string, unknown>>
  return (rows ?? []).map((row) => ({
    id: `cloud-${String(row.id)}`,
    kind: row.kind as ReportKind,
    title: String(row.title ?? 'Report'),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    score: typeof row.score === 'number' ? row.score : null,
    payload: row.payload ?? null,
    resumeSnapshot: (row.resume_snapshot as ResumeData | null) ?? undefined,
    jobSnapshot: (row.job_snapshot as ReportRecord['jobSnapshot']) ?? undefined,
    cloudId: String(row.id),
  }))
}

// ---------------------------------------------------------------------------
// Verification queue helpers
// ---------------------------------------------------------------------------

export async function saveVerificationDecision(
  change: VerificationChange,
  userId: string,
): Promise<void> {
  if (!supabase) return

  // verification_queue references resume_versions which references resumes.
  // For the MVP we upsert a minimal base resume row so the FK chain works.
  const { data: existingResume } = await supabase
    .from('resumes')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  let resumeId = existingResume?.id as string | undefined

  if (!resumeId) {
    const { data: inserted, error: resumeErr } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        content: {} as Record<string, unknown>,
        is_master: true,
      })
      .select('id')
      .single()
    if (resumeErr) throw new Error(`Failed to create base resume: ${resumeErr.message}`)
    resumeId = inserted.id as string
  }

  const { data: versionData, error: versionErr } = await supabase
    .from('resume_versions')
    .insert({
      base_resume_id: resumeId,
      customized_content: {
        change_id: change.id,
        section: change.section,
        changeType: change.changeType,
        original: change.original,
        customized: change.customized,
        reason: change.reason,
        severity: change.severity,
        action: change.action,
      },
    })
    .select('id')
    .single()

  if (versionErr) throw new Error(`Failed to create resume version: ${versionErr.message}`)

  const { error } = await supabase.from('verification_queue').insert({
    resume_version_id: versionData.id as string,
    change_type: change.changeType,
    original_content: { text: change.original } as Record<string, unknown>,
    proposed_content: { text: change.customized } as Record<string, unknown>,
    reason_for_change: change.reason,
    user_action: change.action,
    notes: change.severity,
  })

  if (error) throw new Error(`Failed to save verification decision: ${error.message}`)
}
