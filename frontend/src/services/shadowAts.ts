import type { AtsCheck, JobAnalysis, KeywordEntry, ResumeData } from '@/types/resume'

export interface ShadowResult {
  check: AtsCheck
  keywordLedger: KeywordEntry[]
}

export interface RecruiterCheckItem {
  title: string
  hint: string
  severity: 'error' | 'warning' | 'ok'
}

const REQUIRED_SECTIONS: Array<[keyof Pick<ResumeData, 'professionalSummary' | 'experience' | 'education' | 'skills'>, string]> = [
  ['professionalSummary', 'Summary or objective section absent'],
  ['experience', 'Work experience section absent'],
  ['education', 'Education section absent'],
  ['skills', 'Skills section absent'],
]

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
}

function resumeTokens(resume: ResumeData | undefined): Set<string> {
  const tokens = new Set<string>()
  if (!resume) return tokens
  const consume = (value: unknown, depth = 0): void => {
    if (depth > 6) return
    if (typeof value === 'string') {
      for (const t of value.toLowerCase().replaceAll('/', ' ').replaceAll('-', ' ').split(/\s+/)) {
        if (t) tokens.add(t)
      }
    } else if (Array.isArray(value)) {
      for (const item of value) consume(item, depth + 1)
    } else if (value && typeof value === 'object') {
      for (const item of Object.values(value)) consume(item, depth + 1)
    }
  }
  consume(resume)
  return tokens
}

function extractSkills(job: JobAnalysis | Record<string, unknown> | null | undefined, bucket: 'required' | 'preferred'): string[] {
  if (!job || typeof job !== 'object') return []
  const obj = job as Record<string, unknown>
  for (const key of [`${bucket}Skills`, `${bucket}_skills`]) {
    const found = strList(obj[key])
    if (found.length > 0) return found
  }
  return []
}

function contactState(resume: ResumeData | undefined): { present: boolean; link: boolean } {
  const c = resume?.contact
  const present = Boolean(c?.email?.trim() || c?.phone?.trim())
  const link = Boolean(c?.linkedin?.trim() || c?.github?.trim() || c?.website?.trim())
  return { present, link }
}

export function shadowCheck(resume: ResumeData, job?: JobAnalysis | Record<string, unknown> | null): ShadowResult {
  let score = 100

  const keyword_notes: string[] = []
  const structure_notes: string[] = []
  const formatting_notes: string[] = []
  const parseability_notes: string[] = []
  const missing_headers: string[] = []
  const action_items: string[] = []

  const cs = contactState(resume)
  if (!cs.present) {
    score -= 15
    action_items.push('Add an email and phone number to the contact header.')
    parseability_notes.push('No email or phone in the contact header — many ATS require one.')
  } else if (!cs.link) {
    score -= 2
    parseability_notes.push('No LinkedIn/GitHub link in the header — consider adding one.')
  }

  const sections: Array<[boolean, string, string]> = [
    [Boolean(resume.professionalSummary?.trim()), 'summary', REQUIRED_SECTIONS[0][1]],
    [Boolean(resume.experience?.length), 'experience', REQUIRED_SECTIONS[1][1]],
    [Boolean(resume.education?.length), 'education', REQUIRED_SECTIONS[2][1]],
    [Boolean(resume.skills?.length), 'skills', REQUIRED_SECTIONS[3][1]],
  ]
  for (const [present, name, note] of sections) {
    if (!present) {
      missing_headers.push(name)
      score -= 5
      structure_notes.push(note)
    }
  }

  const experience = resume.experience ?? []
  const bullets = experience.flatMap((e) => (e.bullets ?? []).filter((b) => b.trim()))

  if (!experience.length) {
    score -= 8
    if (!missing_headers.includes('experience')) {
      structure_notes.push('No experience entries — include at least one role or project.')
    }
  } else if (bullets.length) {
    const unquantified = bullets.filter((b) => !/\d/.test(b) && b.length >= 20)
    if (unquantified.length / bullets.length >= 0.4) {
      score -= 6
      formatting_notes.push('40%+ of experience bullets carry no numbers — quantify impact where truthful.')
      action_items.push('Quantify 2-3 experience bullets with real numbers (never invented).')
    }
    if (bullets.some((b) => b.toUpperCase() === b && b.length > 14)) {
      score -= 3
      formatting_notes.push('ALL-CAPS bullet text may confuse text-extraction parsers.')
    }
  }

  const summary = resume.professionalSummary?.trim() ?? ''
  if (summary && summary.length < 30) {
    score -= 4
    structure_notes.push('Summary is very short (< 30 characters).')
  }

  const required = extractSkills(job, 'required')
  const preferred = extractSkills(job, 'preferred')
  const tokens = resumeTokens(resume)
  const gaps = required.filter((kw) => !tokens.has(kw.toLowerCase()))
  score -= Math.min(20, 2 * gaps.length)
  for (const gap of gaps.slice(0, 6)) {
    keyword_notes.push(`Missing required term: ${gap}`)
    action_items.push(`Name ${gap} only where the resume truthfully supports it — attach evidence first.`)
  }
  if (preferred.length) {
    const covered = preferred.filter((kw) => tokens.has(kw.toLowerCase())).length
    if (covered < preferred.length) {
      keyword_notes.push(`Preferred skills partially covered (${covered}/${preferred.length}).`)
    }
  }

  const ledger: KeywordEntry[] = gaps.map((keyword) => ({
    keyword,
    inResume: false,
    addedByCustomization: false,
    inVault: false,
    source: 'required',
  }))

  score = Math.max(0, Math.min(100, score))

  return {
    check: {
      overall_score: score,
      keyword_notes,
      structure_notes,
      formatting_notes,
      missing_headers,
      parseability_notes,
      contact_present: cs.present,
      action_items,
    },
    keywordLedger: ledger,
  }
}

export function recruiterChecklist(resume: ResumeData): RecruiterCheckItem[] {
  const items: RecruiterCheckItem[] = []
  const cs = contactState(resume)

  items.push(
    cs.present
      ? { title: 'Contact header present', hint: 'Email/phone visible on the first screen.', severity: 'ok' }
      : { title: 'No contact email or phone', hint: 'A recruiter cannot reach you from the header.', severity: 'error' },
  )
  if (!cs.present && !cs.link) {
    items.push({ title: 'No online profile links', hint: 'No LinkedIn or GitHub in the header.', severity: 'warning' })
  }

  for (const [, note] of REQUIRED_SECTIONS) {
    const name = note.split(' ')[0].toLowerCase()
    const present =
      name === 'summary'
        ? Boolean(resume.professionalSummary?.trim())
        : name === 'experience'
          ? Boolean(resume.experience?.length)
          : name === 'education'
            ? Boolean(resume.education?.length)
            : Boolean(resume.skills?.length)
    if (!present) {
      items.push({ title: note, hint: 'Section missing entirely.', severity: 'error' })
    }
  }

  const bullets = (resume.experience ?? []).flatMap((e) => (e.bullets ?? []).filter((b) => b.trim()))
  if (bullets.length) {
    const unquantified = bullets.filter((b) => !/\d/.test(b)).length
    if (unquantified / bullets.length >= 0.4) {
      items.push({
        title: 'Bullets read as unquantified',
        hint: `${unquantified} of ${bullets.length} experience bullets carry no numbers.`,
        severity: 'warning',
      })
    }
  }

  const exp = resume.experience ?? []
  const dateIssue = exp.some((e) => {
    const start = e.startDate ? new Date(e.startDate) : null
    const end = e.endDate ? new Date(e.endDate) : null
    return Boolean(start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start > end)
  })
  if (dateIssue) {
    items.push({ title: 'Mixed role dates', hint: 'At least one role ends before it starts.', severity: 'error' })
  }

  if (!resume.professionalSummary?.trim()) {
    items.push({ title: 'No summary line', hint: 'First eye-contact with the resume is a bullet list.', severity: 'warning' })
  }

  return items
}