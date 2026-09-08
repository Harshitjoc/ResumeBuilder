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

export interface VerificationChange {
  id: string
  section: string
  changeType: string
  original: string
  customized: string
  reason: string
  severity: 'low' | 'medium' | 'high'
  action: 'approved' | 'rejected' | 'edited' | 'pending'
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
