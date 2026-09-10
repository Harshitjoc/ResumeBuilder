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
  applications: ApplicationRecord[]
  shares: ShareRecord[]
  plan: PlanInfo
  sessionStatus: SessionStatus
  sessionUser: SessionUser | null
  role: string | null
  setResume: (resume: ResumeData) => void
  updateContact: (contact: Partial<ResumeData['contact']>) => void
  updateSummary: (summary: string) => void
  updateSkills: (skills: string[]) => void
  setTemplate: (template: ResumeData['template']) => void
  setApiKeys: (keys: ApiKeys | null) => void
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
  addApplication: (data: Omit<ApplicationRecord, 'id' | 'appliedAt'>) => void
  updateApplicationStatus: (id: string, status: ApplicationStatus) => void
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
  clearSession: () => void
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

      setResume: (resume) => set({ resume }),
      updateContact: (contact) =>
        set((state) => ({
          resume: { ...state.resume, contact: { ...state.resume.contact, ...contact } },
        })),
      updateSummary: (professionalSummary) =>
        set((state) => ({ resume: { ...state.resume, professionalSummary } })),
      updateSkills: (skills) =>
        set((state) => ({ resume: { ...state.resume, skills } })),
      setTemplate: (template) =>
        set((state) => ({ resume: { ...state.resume, template } })),

      setApiKeys: (apiKeys) => set({ apiKeys }),

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
      clearSession: () => set({ sessionStatus: 'signed-out', sessionUser: null, role: null }),
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
        applications: state.applications,
        shares: state.shares,
        plan: state.plan,
      }),
    },
  ),
)
