export interface ContactInfo {
  fullName: string
  email: string
  phone: string
  linkedin: string
  github: string
  website: string
}

export interface Experience {
  id: string
  jobTitle: string
  company: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface Education {
  id: string
  degree: string
  school: string
  endDate: string
  gpa?: string
}

export interface Project {
  id: string
  name: string
  description: string
  link: string
  technologies: string[]
}

export interface Certification {
  id: string
  name: string
  issuer: string
  date: string
}

export type TemplateId = 'classic' | 'modern' | 'minimal' | 'bold' | 'professional'

export interface SavedTemplate {
  id: string
  name: string
  createdAt: string
  resume: ResumeData
}

export interface ResumeData {
  id?: string
  contact: ContactInfo
  professionalSummary: string
  skills: string[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  certifications: Certification[]
  notes: string
  template: TemplateId
}

export type TargetUser = 'recent-grad' | 'working-professional' | 'career-switcher'

export interface EvidenceItem {
  id: string
  category: 'skill' | 'achievement' | 'metric' | 'project' | 'education' | 'certification'
  text: string
  confidence: 'high' | 'medium' | 'low'
  source: 'document' | 'user'
  createdAt?: string
}

export type ClaimVerdict = 'verified' | 'confirmed' | 'unverifiable' | 'ai-drafted'

export interface ClaimRecord {
  id: string
  text: string
  section?: string
  verdict: ClaimVerdict
  evidenceId?: string
  resolvedAt: string
}

export interface VerifiabilityResult {
  total: number
  verified: number
  unverifiable: number
  neutral: number
  ai_drafted: number
  honesty_score: number
  flagged: Array<{ section: string; text: string; reason?: string }>
}

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected'

export type ApplicationSource = 'customize' | 'tracker-form' | 'extension'

export type KeywordSource = 'required' | 'preferred' | 'ats'

export interface KeywordEntry {
  keyword: string
  inResume: boolean
  addedByCustomization: boolean
  inVault: boolean
  source: KeywordSource
}

export interface ApplicationRecord {
  id: string
  jobTitle: string
  company: string
  status: ApplicationStatus
  appliedAt: string
  decayed?: boolean
  jobUrl: string
  notes: string
  resumeVariant?: ResumeData
  atsScore?: number | null
  genuineScore?: number | null
  keywordLedger?: KeywordEntry[]
  keywordGaps?: string[]
  jobSource?: ApplicationSource
  atsSnapshot?: AtsCheck | null
}

export interface AtsCheck {
  overall_score: number
  keyword_notes: string[]
  structure_notes: string[]
  formatting_notes: string[]
  missing_headers: string[]
  parseability_notes: string[]
  contact_present: boolean
  action_items: string[]
}

export type TruthStatus = 'proof-backed' | 'in-resume' | 'needs-research'

export interface TruthPoint {
  text: string
  section?: string | null
  claimId?: string | null
  status: TruthStatus
  proof?: string | null
  kind?: 'question' | 'talking-point'
}

export interface InterviewPrep {
  likely_questions: string[]
  company_research: string[]
  talking_points: string[]
  questions_to_ask: string[]
  truth_points?: TruthPoint[]
}

export interface TruthSummary {
  proofBacked: number
  inResume: number
  needsResearch: number
}

export interface ShareRecord {
  id: string
  slug: string
  createdAt: string
  name: string
  resume: ResumeData
  atsScore: number | null
  evidence?: EvidenceItem[]
  heuristicAts?: boolean | null
}

export interface CoverLetterResult {
  letter: string
}

export interface ContactConfidence {
  fullName: number
  email: number
  phone: number
  linkedin: number
  github: number
  website: number
}

export interface DocumentClassification {
  kind: 'resume' | 'cover-letter' | 'job-posting' | 'other'
  is_resume_like: boolean
  confidence: number
  signals: string[]
  reason: string
  score: number
}

export interface ParseResumeResult {
  parsed: ResumeData
  evidence: EvidenceItem[]
  contactConfidence: ContactConfidence
  documentType?: DocumentClassification
}

export interface VerificationChange {
  id: string
  section: string
  changeType: string
  original: string
  customized: string
  reason: string
  severity: 'low' | 'medium' | 'high'
  action: 'approved' | 'rejected' | 'edited' | 'pending' | 'blocked'
  confidence?: 'high' | 'medium' | 'low'
  isAuthentic?: boolean
  verdict?: ClaimVerdict
  evidenceId?: string
}

export interface JobAnalysis {
  jobTitle: string
  company: string
  seniorityLevel: string
  roleType: string
  requiredSkills: string[]
  preferredSkills: string[]
  yearsExperience: string
  keyResponsibilities: string[]
  compatibilityScore: number
  recommendation: string
  skillMatchPercentage: number
  skillGaps: string[]
  skillStrengths: string[]
  concerns: string[]
}

export const emptyResume: ResumeData = {
  contact: {
    fullName: '',
    email: '',
    phone: '',
    linkedin: '',
    github: '',
    website: '',
  },
  professionalSummary: '',
  skills: [],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  notes: '',
  template: 'classic',
}

export interface CustomizationResult {
  customized: ResumeData
  changes: VerificationChange[]
  summary: string
}

export type ReportKind = 'resume-analysis' | 'job-analysis' | 'verification' | 'resume-snapshot'

export interface ReportRecord {
  id: string
  kind: ReportKind
  title: string
  createdAt: string
  score: number | null
  payload: unknown
  resumeSnapshot?: ResumeData
  jobSnapshot?: {
    jobTitle?: string
    company?: string
    rawText?: string
    parsed?: Record<string, unknown>
  }
  cloudId?: string
}
