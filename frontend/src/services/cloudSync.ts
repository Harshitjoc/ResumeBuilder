import { useAppStore } from '@/store/appStore'
import type {
  ResumeData,
  ApplicationRecord,
  EvidenceItem,
  ShareRecord,
  ReportRecord,
} from '@/types/resume'
import {
  supabase,
  isSupabaseConfigured,
  getAnalysisReports,
} from '@/services/supabase'

let subscribed = false
let lastHydratedUid: string | null = null
let masterResumeId: string | null = null

export function resetCloudSyncState(): void {
  lastHydratedUid = null
  masterResumeId = null
}

export function currentUserId(): string | null {
  if (!isSupabaseConfigured) return null
  return useAppStore.getState().sessionUser?.id ?? null
}

function store() {
  return useAppStore.getState()
}

// ---------------------------------------------------------------------------
// Hydration (cloud -> store) on session start
// ---------------------------------------------------------------------------

export async function startCloudSync(): Promise<void> {
  const userId = currentUserId()
  if (!userId || !supabase) return
  if (userId !== lastHydratedUid) {
    lastHydratedUid = userId
    masterResumeId = null
    await hydrate(userId)
  }
  ensureSubscription()
}

async function hydrate(userId: string): Promise<void> {
  const sb = supabase
  if (!sb) return
  const s = store()

  const { data: resumeRow } = await sb
    .from('resumes')
    .select('id, content')
    .eq('user_id', userId)
    .eq('is_master', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (resumeRow?.content) {
    masterResumeId = String(resumeRow.id)
    s.setResume(resumeRow.content as ResumeData)
  }

  const { data: appRows } = await sb
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })
  if (appRows?.length) {
    s.setApplications(
      appRows.map((row) => ({
        id: String(row.id),
        jobTitle: String(row.job_title ?? ''),
        company: String(row.company_name ?? ''),
        status: (row.status as ApplicationRecord['status']) ?? 'applied',
        appliedAt: String(row.applied_at ?? new Date().toISOString()),
        jobUrl: String(row.job_url ?? ''),
        notes: String(row.notes ?? ''),
      })),
    )
  }

  const { data: evRows } = await sb
    .from('evidence')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (evRows?.length) {
    s.setEvidence(
      evRows.map((row) => ({
        id: String(row.id),
        category: row.category as EvidenceItem['category'],
        text: String(row.text),
        confidence: (row.confidence as EvidenceItem['confidence']) ?? 'medium',
        source: (row.source as EvidenceItem['source']) ?? 'user',
      })),
    )
  }

  const { data: shareRows } = await sb
    .from('shares')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (shareRows?.length) {
    s.setShares(
      shareRows.map((row) => ({
        id: String(row.id),
        slug: String(row.slug),
        createdAt: String(row.created_at ?? new Date().toISOString()),
        name: String(row.name),
        resume: row.resume_snapshot as ResumeData,
        atsScore: typeof row.ats_score === 'number' ? row.ats_score : null,
      })),
    )
  }

  try {
    const reports = await getAnalysisReports(userId)
    if (reports.length) s.setReports(reports)
  } catch {
    /* keep local reports */
  }
}

// ---------------------------------------------------------------------------
// Write-through (store -> cloud), debounced
// ---------------------------------------------------------------------------

function ensureSubscription(): void {
  if (subscribed) return
  subscribed = true
  let timer: ReturnType<typeof setTimeout> | null = null

  useAppStore.subscribe((state, prev) => {
    const changed =
      state.resume !== prev.resume ||
      state.applications !== prev.applications ||
      state.evidence !== prev.evidence ||
      state.shares !== prev.shares ||
      state.reports !== prev.reports
    if (!changed) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      pushAll().catch(() => {})
    }, 800)
  })
}

async function pushAll(): Promise<void> {
  const userId = currentUserId()
  const sb = supabase
  if (!userId || !sb) return
  const s = store()

  await pushResume(userId, s.resume, sb)
  await pushApplications(userId, s.applications, sb)
  await pushEvidence(userId, s.evidence, sb)
  await pushShares(userId, s.shares, sb)
  await pushReports(userId, s.reports, sb)
}

async function pushResume(userId: string, resume: ResumeData, sb: NonNullable<typeof supabase>): Promise<void> {
  const isEmpty =
    !resume.contact.fullName &&
    !resume.professionalSummary &&
    resume.skills.length === 0 &&
    resume.experience.length === 0 &&
    resume.education.length === 0
  if (isEmpty) return

  if (!masterResumeId) {
    const { data } = await sb
      .from('resumes')
      .select('id')
      .eq('user_id', userId)
      .eq('is_master', true)
      .limit(1)
      .maybeSingle()
    masterResumeId = data?.id ? String(data.id) : null
  }

  if (masterResumeId) {
    await sb
      .from('resumes')
      .update({ content: resume as unknown as Record<string, unknown>, template_format: resume.template })
      .eq('id', masterResumeId)
  } else {
    const { data } = await sb
      .from('resumes')
      .insert({
        user_id: userId,
        content: resume as unknown as Record<string, unknown>,
        template_format: resume.template,
        is_master: true,
      })
      .select('id')
      .single()
    masterResumeId = data?.id ? String(data.id) : null
  }
}

async function pushApplications(userId: string, applications: ApplicationRecord[], sb: NonNullable<typeof supabase>): Promise<void> {
  for (const app of applications) {
    if (app.id.length > 20) continue // already a cloud uuid
    const { data } = await sb
      .from('applications')
      .insert({
        user_id: userId,
        job_url: app.jobUrl,
        job_title: app.jobTitle,
        company_name: app.company,
        status: app.status,
        applied_at: app.appliedAt,
        notes: app.notes,
      })
      .select('id')
      .single()
    const cloudId = data?.id ? String(data.id) : null
    if (cloudId) {
      useAppStore.setState((state) => ({
        applications: state.applications.map((a) => (a.id === app.id ? { ...a, id: cloudId } : a)),
      }))
    }
  }
}

async function pushEvidence(userId: string, evidence: EvidenceItem[], sb: NonNullable<typeof supabase>): Promise<void> {
  for (const item of evidence) {
    if (item.id.length > 20) continue
    const { data } = await sb
      .from('evidence')
      .insert({
        user_id: userId,
        category: item.category,
        text: item.text,
        confidence: item.confidence,
        source: item.source,
      })
      .select('id')
      .single()
    const cloudId = data?.id ? String(data.id) : null
    if (cloudId) {
      useAppStore.setState((state) => ({
        evidence: state.evidence.map((e) => (e.id === item.id ? { ...e, id: cloudId } : e)),
      }))
    }
  }
}

async function pushShares(userId: string, shares: ShareRecord[], sb: NonNullable<typeof supabase>): Promise<void> {
  for (const share of shares) {
    if (share.id.length > 20) continue
    const { data } = await sb
      .from('shares')
      .insert({
        user_id: userId,
        slug: share.slug,
        name: share.name,
        resume_snapshot: share.resume as unknown as Record<string, unknown>,
        ats_score: share.atsScore,
      })
      .select('id')
      .single()
    const cloudId = data?.id ? String(data.id) : null
    if (cloudId) {
      useAppStore.setState((state) => ({
        shares: state.shares.map((sh) => (sh.id === share.id ? { ...sh, id: cloudId } : sh)),
      }))
    }
  }
}

async function pushReports(userId: string, reports: ReportRecord[], sb: NonNullable<typeof supabase>): Promise<void> {
  for (const report of reports) {
    if (report.cloudId || report.id.startsWith('cloud-')) continue
    const { data } = await sb
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
    if (data?.id) {
      useAppStore.getState().setReportCloudId(report.id, String(data.id))
    }
  }
}