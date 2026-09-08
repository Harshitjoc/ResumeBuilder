import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  emptyResume,
  type ResumeData,
  type VerificationChange,
} from '@/types/resume'

interface ApiKeys {
  primaryProvider: string
  primaryKey: string
  primaryModel: string
  secondaryProvider?: string
  secondaryKey?: string
  secondaryModel?: string
}

interface AppState {
  resume: ResumeData
  apiKeys: ApiKeys | null
  pendingChanges: VerificationChange[]
  jobPosting: string
  compatibilityScore: number | null
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
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      resume: emptyResume,
      apiKeys: null,
      pendingChanges: [],
      jobPosting: '',
      compatibilityScore: null,

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
    }),
    {
      name: 'resume-builder-storage',
    },
  ),
)
