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
  template: "classic" | "modern"
}

export function isResumeData(value: unknown): value is ResumeData {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>

  if (typeof v.contact !== "object" || v.contact === null) return false
  const c = v.contact as Record<string, unknown>
  if (typeof c.fullName !== "string") return false
  if (typeof c.email !== "string") return false
  if (typeof c.phone !== "string") return false

  if (typeof v.professionalSummary !== "string") return false
  if (!Array.isArray(v.skills)) return false
  if (!Array.isArray(v.experience)) return false
  if (!Array.isArray(v.education)) return false
  if (!Array.isArray(v.projects)) return false
  if (!Array.isArray(v.certifications)) return false

  return true
}
