import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  emptyResume,
  type ResumeData,
  type VerificationChange,
  type ReportRecord,
  type TargetUser,
  type EvidenceItem,
  type ApplicationRecord,
  type ApplicationStatus,
  type ShareRecord,
  type SavedTemplate,
  type ClaimRecord,
  type JobAnalysis,
  type AtsCheck,
} from '@/types/resume'

interface ApiKeys {
  primaryProvider: string
  primaryKey: string
  primaryModel: string
  secondaryProvider?: string
  secondaryKey?: string
  secondaryModel?: string
}

export interface PlanInfo {
  tier: 'free' | 'pro'
  expiresAt: string | null
  quotaRemaining: number | null
  quotaLimit: number | null
  quotaExceeded: boolean
}

export type SessionStatus = 'loading' | 'signed-in' | 'signed-out' | 'anonymous'

export interface SessionUser {
  id: string
  email: string | null
  full_name: string | null
  is_anonymous: boolean
  avatarUrl?: string | null
  phone?: string | null
  location?: string | null
  headline?: string | null
}

export interface PendingVariant {
  resume: ResumeData
  baseResume: ResumeData
  analysis?: JobAnalysis
  ats?: AtsCheck
}

interface AppState {
  resume: ResumeData
  apiKeys: ApiKeys | null
  pendingChanges: VerificationChange[]
  jobPosting: string
  compatibilityScore: number | null
  reports: ReportRecord[]
  targetUser: TargetUser | null
  evidence: EvidenceItem[]
  confirmedClaims: ClaimRecord[]
  applications: ApplicationRecord[]
  shares: ShareRecord[]
  plan: PlanInfo
  sessionStatus: SessionStatus
  sessionUser: SessionUser | null
  role: string | null
  features: Record<string, boolean>
  pendingVariant?: PendingVariant
  setResume: (resume: ResumeData) => void
  updateContact: (contact: Partial<ResumeData['contact']>) => void
  updateSummary: (summary: string) => void
  updateNotes: (notes: string) => void
  updateSkills: (skills: string[]) => void
  setTemplate: (template: ResumeData['template']) => void
  setApiKeys: (keys: ApiKeys | null) => void
  clearApiKeys: () => void
  setPendingChanges: (changes: VerificationChange[]) => void
  updateChangeAction: (id: string, action: VerificationChange['action']) => void
  setJobPosting: (text: string) => void
  setCompatibilityScore: (score: number | null) => void
  resetResume: () => void
  setReports: (reports: ReportRecord[]) => void
  addReport: (data: Omit<ReportRecord, 'id' | 'createdAt'>) => ReportRecord
  setReportCloudId: (id: string, cloudId: string) => void
  setTargetUser: (targetUser: TargetUser | null) => void
  addEvidence: (item: Omit<EvidenceItem, 'id'>) => void
  removeEvidence: (id: string) => void
  setEvidence: (evidence: EvidenceItem[]) => void
  addConfirmedClaims: (claims: Array<Omit<ClaimRecord, 'id' | 'resolvedAt'>>) => void
  setConfirmedClaims: (claims: ClaimRecord[]) => void
  attachChangeEvidence: (changeId: string, evidenceId: string) => void
  addApplication: (data: Omit<ApplicationRecord, 'id' | 'appliedAt'>) => void
  updateApplicationStatus: (id: string, status: ApplicationStatus) => void
  patchApplication: (id: string, patch: Partial<ApplicationRecord>) => void
  removeApplication: (id: string) => void
  setApplications: (applications: ApplicationRecord[]) => void
  addShare: (data: Omit<ShareRecord, 'id' | 'createdAt'>) => void
  removeShare: (id: string) => void
  setShares: (shares: ShareRecord[]) => void
  setPlan: (plan: Partial<PlanInfo>) => void
  decrementQuota: () => void
  setQuotaExceeded: (exceeded: boolean) => void
  setSession: (user: SessionUser | null, status: SessionStatus) => void
  setRole: (role: string | null) => void
  setFeatures: (features: Record<string, boolean>) => void
  clearSession: () => void
  applyApprovedChanges: (dna?: { analysis?: JobAnalysis; ats?: AtsCheck }) => void
  setPendingVariant: (pv: PendingVariant | undefined) => void
  ownerUserId: string | null
  setOwnerUserId: (id: string | null) => void
  resetWorkspace: () => void
  customTemplates: SavedTemplate[]
  addCustomTemplate: (data: Omit<SavedTemplate, 'id' | 'createdAt'>) => void
  removeCustomTemplate: (id: string) => void
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      resume: emptyResume,
      apiKeys: null,
      pendingChanges: [],
      jobPosting: '',
      compatibilityScore: null,
      reports: [],
      targetUser: null,
      evidence: [],
      confirmedClaims: [],
      applications: [],
      shares: [],
      plan: {
        tier: 'free',
        expiresAt: null,
        quotaRemaining: null,
        quotaLimit: null,
        quotaExceeded: false,
      },
      sessionStatus: 'loading',
      sessionUser: null,
      role: null,
      features: {},
      ownerUserId: null,
      customTemplates: [],

      setResume: (resume) => set({ resume }),
      updateContact: (contact) =>
        set((state) => ({
          resume: { ...state.resume, contact: { ...state.resume.contact, ...contact } },
        })),
      updateSummary: (professionalSummary) =>
        set((state) => ({ resume: { ...state.resume, professionalSummary } })),
      updateNotes: (notes) =>
        set((state) => ({ resume: { ...state.resume, notes } })),
      updateSkills: (skills) =>
        set((state) => ({ resume: { ...state.resume, skills } })),
      setTemplate: (template) =>
        set((state) => ({ resume: { ...state.resume, template } })),

      setApiKeys: (apiKeys) => set({ apiKeys }),
      clearApiKeys: () => set({ apiKeys: null }),

      setPendingChanges: (pendingChanges) => set({ pendingChanges }),
      updateChangeAction: (id, action) =>
        set((state) => ({
          pendingChanges: state.pendingChanges.map((c) =>
            c.id === id ? { ...c, action } : c,
          ),
        })),

      setJobPosting: (jobPosting) => set({ jobPosting }),
      setCompatibilityScore: (compatibilityScore) => set({ compatibilityScore }),
      resetResume: () => set({ resume: emptyResume, pendingChanges: [], compatibilityScore: null }),

      setReports: (reports) => set({ reports }),
      addReport: (data) => {
        const report: ReportRecord = { id: uid(), createdAt: new Date().toISOString(), ...data }
        set((state) => ({ reports: [report, ...state.reports] }))
        return report
      },
      setReportCloudId: (id, cloudId) =>
        set((state) => ({
          reports: state.reports.map((r) => (r.id === id ? { ...r, cloudId } : r)),
        })),

      setTargetUser: (targetUser) => set({ targetUser }),

      addEvidence: (item) =>
        set((state) => {
          const exists = state.evidence.some(
            (e) => e.text === item.text && e.category === item.category,
          )
          if (exists) return state
          return { evidence: [...state.evidence, { id: uid(), ...item }] }
        }),
      removeEvidence: (id) =>
        set((state) => ({ evidence: state.evidence.filter((e) => e.id !== id) })),
      setEvidence: (evidence) => set({ evidence }),
      addConfirmedClaims: (claims) =>
        set((state) => {
          const fresh = claims
            .filter((c) => c.text?.trim())
            .map((c) => ({
              id: uid(),
              resolvedAt: new Date().toISOString(),
              ...c,
            }))
          if (fresh.length === 0) return state
          return { confirmedClaims: [...fresh, ...state.confirmedClaims] }
        }),
      setConfirmedClaims: (confirmedClaims) => set({ confirmedClaims }),
      attachChangeEvidence: (changeId, evidenceId) =>
        set((state) => ({
          pendingChanges: state.pendingChanges.map((c) =>
            c.id === changeId
              ? { ...c, evidenceId, verdict: 'confirmed', action: 'pending' as const }
              : c,
          ),
        })),

      addApplication: (data) =>
        set((state) => ({
          applications: [
            { id: uid(), appliedAt: new Date().toISOString(), ...data },
            ...state.applications,
          ],
        })),
      updateApplicationStatus: (id, status) =>
        set((state) => ({
          applications: state.applications.map((a) =>
            a.id === id ? { ...a, status } : a,
          ),
        })),
      patchApplication: (id, patch) =>
        set((state) => ({
          applications: state.applications.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),
      removeApplication: (id) =>
        set((state) => ({
          applications: state.applications.filter((a) => a.id !== id),
        })),
      setApplications: (applications) => set({ applications }),

      addShare: (data) =>
        set((state) => ({
          shares: [
            { id: uid(), createdAt: new Date().toISOString(), ...data },
            ...state.shares,
          ],
        })),
      removeShare: (id) =>
        set((state) => ({ shares: state.shares.filter((s) => s.id !== id) })),
      setShares: (shares) => set({ shares }),
      setPlan: (plan) => set((state) => ({ plan: { ...state.plan, ...plan } })),
      decrementQuota: () =>
        set((state) => ({
          plan: {
            ...state.plan,
            quotaRemaining:
              state.plan.quotaRemaining === null
                ? null
                : Math.max(0, state.plan.quotaRemaining - 1),
          },
        })),
      setQuotaExceeded: (quotaExceeded) => set((state) => ({ plan: { ...state.plan, quotaExceeded } })),
      setSession: (user, sessionStatus) => set({ sessionUser: user, sessionStatus }),
      setRole: (role) => set({ role }),
      setFeatures: (features) => set({ features }),
      setOwnerUserId: (ownerUserId) => set({ ownerUserId }),
      clearSession: () => set({ sessionStatus: 'signed-out', sessionUser: null, role: null, features: {} }),
      resetWorkspace: () =>
        set({
          resume: emptyResume,
          pendingChanges: [],
          jobPosting: '',
          compatibilityScore: null,
          reports: [],
          evidence: [],
          confirmedClaims: [],
          applications: [],
          shares: [],
          targetUser: null,
          customTemplates: [],
          pendingVariant: undefined,
        }),
      addCustomTemplate: (data) =>
        set((state) => ({
          customTemplates: [
            { id: uid(), createdAt: new Date().toISOString(), ...data },
            ...state.customTemplates,
          ],
        })),
      removeCustomTemplate: (id) =>
        set((state) => ({
          customTemplates: state.customTemplates.filter((t) => t.id !== id),
        })),

      setPendingVariant: (pendingVariant) => set({ pendingVariant }),

      applyApprovedChanges: (dna) =>
        set((state) => {
          const baseResume = { ...state.resume }
          const resume = { ...state.resume }
          const approved = state.pendingChanges.filter(
            (c) => c.action === 'approved' || c.action === 'edited',
          )
          if (approved.length === 0) return state

          for (const change of approved) {
            const sec = change.section.toLowerCase()
            const orig = change.original
            const cust = change.customized

            if (sec === 'summary' || sec === 'professional_summary') {
              resume.professionalSummary = cust
            } else if (sec === 'skills') {
              const idx = resume.skills.findIndex((s) => s === orig || s.includes(orig) || orig.includes(s))
              if (idx >= 0) resume.skills = resume.skills.map((s, i) => (i === idx ? cust : s))
            } else if (sec.includes('experience') || sec === 'work_experience') {
              resume.experience = resume.experience.map((exp) => ({
                ...exp,
                bullets: exp.bullets.map((b) => (b === orig || b.includes(orig) || orig.includes(b) ? cust : b)),
              }))
            } else if (sec.includes('education')) {
              resume.education = resume.education.map((edu) => ({
                ...edu,
                degree: edu.degree === orig || edu.degree.includes(orig) ? cust : edu.degree,
              }))
            } else if (sec.includes('project')) {
              resume.projects = resume.projects.map((proj) => ({
                ...proj,
                description: proj.description === orig || proj.description.includes(orig) || orig.includes(proj.description) ? cust : proj.description,
                technologies: proj.technologies.map((t) => (t === orig || t.includes(orig) || orig.includes(t) ? cust : t)),
              }))
            } else if (sec.includes('cert')) {
              resume.certifications = resume.certifications.map((cert) => ({
                ...cert,
                name: cert.name === orig || cert.name.includes(orig) ? cust : cert.name,
              }))
            } else if (sec === 'notes') {
              resume.notes = cust
            }
          }

          return {
            resume,
            pendingChanges: [],
            pendingVariant: {
              resume,
              baseResume: state.pendingVariant?.baseResume ?? baseResume,
              analysis: dna?.analysis ?? state.pendingVariant?.analysis,
              ats: dna?.ats ?? state.pendingVariant?.ats,
            },
          }
        }),
    }),
    {
      name: 'resume-builder-storage',
      partialize: (state) => ({
        resume: state.resume,
        apiKeys: state.apiKeys,
        pendingChanges: state.pendingChanges,
        jobPosting: state.jobPosting,
        compatibilityScore: state.compatibilityScore,
        reports: state.reports,
        targetUser: state.targetUser,
        evidence: state.evidence,
        confirmedClaims: state.confirmedClaims,
        applications: state.applications,
        shares: state.shares,
        plan: state.plan,
        ownerUserId: state.ownerUserId,
        sessionStatus: state.sessionStatus,
        customTemplates: state.customTemplates,
        pendingVariant: state.pendingVariant,
      }),
    },
  ),
)
