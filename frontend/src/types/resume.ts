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

export interface ResumeData {
  id?: string
  contact: ContactInfo
  professionalSummary: string
  skills: string[]
  experience: Experience[]
  education: Education[]
  projects: Project[]
  certifications: Certification[]
  template: 'classic' | 'modern'
}

export type TargetUser = 'recent-grad' | 'working-professional' | 'career-switcher'

export interface EvidenceItem {
  id: string
  category: 'skill' | 'achievement' | 'metric' | 'project' | 'education' | 'certification'
  text: string
  confidence: 'high' | 'medium' | 'low'
  source: 'document' | 'user'
}

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected'

export interface ApplicationRecord {
  id: string
  jobTitle: string
  company: string
  status: ApplicationStatus
  appliedAt: string
  jobUrl: string
  notes: string
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

export interface InterviewPrep {
  likely_questions: string[]
  company_research: string[]
  talking_points: string[]
  questions_to_ask: string[]
}

export interface CoverLetterResult {
  letter: string
}

export interface ShareRecord {
  id: string
  slug: string
  createdAt: string
  name: string
  resume: ResumeData
  atsScore: number | null
}

export interface ContactConfidence {
  fullName: number
  email: number
  phone: number
  linkedin: number
  github: number
  website: number
}

export interface ParseResumeResult {
  parsed: ResumeData
  evidence: EvidenceItem[]
  contactConfidence: ContactConfidence
}

export interface VerificationChange {
  id: string
  section: string
  changeType: string
  original: string
  customized: string
  reason: string
  severity: 'low' | 'medium' | 'high'
  action: 'approved' | 'rejected' | 'edited' | 'pending'
  confidence?: 'high' | 'medium' | 'low'
  isAuthentic?: boolean
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
