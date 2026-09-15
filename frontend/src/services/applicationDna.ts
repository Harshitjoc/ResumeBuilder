import type {
  ApplicationRecord,
  AtsCheck,
  ClaimRecord,
  EvidenceItem,
  JobAnalysis,
  KeywordEntry,
  KeywordSource,
  ResumeData,
} from '@/types/resume'
import { computeGenuineScore, evidenceSupports } from '@/services/verifiability'

const KNOWN_SKILLS = new Set([
  'react', 'python', 'typescript', 'javascript', 'java', 'go', 'golang', 'rust',
  'node', 'nodejs', 'express', 'django', 'flask', 'fastapi', 'graphql', 'rest',
  'api', 'docker', 'kubernetes', 'k8s', 'terraform', 'aws', 'gcp', 'azure',
  'postgres', 'postgresql', 'mysql', 'mongodb', 'redis', 'sql', 'nosql',
  'html', 'css', 'sass', 'tailwind', 'webpack', 'vite', 'jest', 'cypress',
  'pytest', 'selenium', 'git', 'ci/cd', 'jenkins', 'github actions', 'linux',
  'machine learning', 'deep learning', 'nlp', 'tensorflow', 'pytorch',
  'pandas', 'numpy', 'spark', 'kafka', 'rabbitmq', 'elasticsearch', 'tableau',
  'agile', 'scrum', 'product management', 'data analysis', 'testing',
  'sdlc', 'microservices', 'serverless', 'oop', 'design patterns',
])

function tokenize(text: string): Set<string> {
  const out = new Set<string>()
  for (const t of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (t.length > 1) out.add(t)
  }
  return out
}

function resumeTokens(resume: ResumeData): Set<string> {
  const tokens = new Set<string>()
  const text = [
    resume.contact.fullName,
    resume.professionalSummary,
    ...(resume.skills ?? []),
    ...(resume.experience ?? []).flatMap((e) => [e.jobTitle, e.company, e.startDate, e.endDate, ...(e.bullets ?? [])]),
    ...(resume.projects ?? []).flatMap((p) => [p.name, p.description, ...(p.technologies ?? [])]),
    ...(resume.education ?? []).flatMap((e) => [e.school, e.degree, e.endDate]),
    ...(resume.certifications ?? []).map((c) => c.name),
    resume.notes,
  ]
  for (const part of text) {
    for (const t of tokenize(part ?? '')) tokens.add(t)
  }
  return tokens
}

function collectKeyword(tokens: Set<string>, keyword: string, baseTokens: Set<string>): Omit<KeywordEntry, 'source'> {
  const item = keyword.toLowerCase()
  const inResume = item.split(/[^a-z0-9]+/).every((t) => t.length > 1 ? tokens.has(t) : true)
  const addedByCustomization =
    inResume && item.split(/[^a-z0-9]+/).some((t) => t.length > 1 && tokens.has(t) && !baseTokens.has(t))
  return { keyword, inResume, addedByCustomization, inVault: false }
}

export function collectKeywordVaultStatus(
  keyword: string,
  evidence: EvidenceItem[],
): boolean {
  return Boolean(evidenceSupports(keyword, evidence))
}

export function deriveKeywordLedger(input: {
  variant: ResumeData
  baseResume: ResumeData
  analysis?: JobAnalysis
  ats?: AtsCheck
  evidence: EvidenceItem[]
}): KeywordEntry[] {
  const keywords: Array<{ kw: string; source: KeywordSource }> = []
  const push = (items: string[] | undefined, source: KeywordSource) => {
    for (const it of items ?? []) {
      if (it?.trim()) keywords.push({ kw: it.trim(), source })
    }
  }
  push(input.analysis?.requiredSkills, 'required')
  push(input.analysis?.skillGaps, 'required')
  push(input.analysis?.preferredSkills, 'preferred')

  const atsKeywords = new Set<string>()
  for (const note of input.ats?.keyword_notes ?? []) {
    for (const token of note.split(/[,;]/)) {
      const clean = token.replace(/[•\-*:()"]/g, '').trim().toLowerCase()
      if (clean) atsKeywords.add(clean)
    }
  }
  for (const action of input.ats?.action_items ?? []) {
    for (const token of action.split(/[,;]/)) {
      const clean = token.replace(/[•\-*:()"]/g, '').trim().toLowerCase()
      if (clean && clean.length > 2 && !/^(add|the|a|an|your|ensure|make|use|for|with)$/.test(clean)) {
        atsKeywords.add(clean)
      }
    }
  }
  for (const kw of atsKeywords) keywords.push({ kw, source: 'ats' })

  const variantTokens = resumeTokens(input.variant)
  const baseTokens = resumeTokens(input.baseResume)
  const seen = new Set<string>()
  const ledger: KeywordEntry[] = []

  for (const { kw, source } of keywords) {
    const key = kw.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const entry = collectKeyword(variantTokens, kw, baseTokens)
    ledger.push({
      ...entry,
      inVault: collectKeywordVaultStatus(kw, input.evidence),
      source,
    })
  }

  ledger.sort((a, b) => Number(a.inResume) - Number(b.inResume) || a.source.localeCompare(b.source) || a.keyword.localeCompare(b.keyword))
  return ledger
}

export function keywordGaps(ledger: KeywordEntry[] | undefined): string[] {
  return [...new Set((ledger ?? []).filter((e) => !e.inResume).map((e) => e.keyword))].sort()
}

export function gapPatterns(
  applications: ApplicationRecord[],
): Array<{ keyword: string; missingCount: number; rejectedWithGap: number }> {
  const tally = new Map<string, number>()
  const rejected = new Map<string, number>()
  for (const app of applications) {
    for (const gap of keywordGaps(app.keywordLedger)) {
      tally.set(gap, (tally.get(gap) ?? 0) + 1)
      if (app.status === 'rejected') rejected.set(gap, (rejected.get(gap) ?? 0) + 1)
    }
  }
  return [...tally.entries()]
    .map(([keyword, missingCount]) => ({
      keyword,
      missingCount,
      rejectedWithGap: rejected.get(keyword) ?? 0,
    }))
    .sort((a, b) => b.missingCount - a.missingCount || a.keyword.localeCompare(b.keyword))
}

export function keywordSectionHint(keyword: string): 'skills' | 'education' | 'projects' | 'certifications' {
  const key = keyword.toLowerCase()
  if (KNOWN_SKILLS.has(key)) return 'skills'
  if (/degree|bsc|mba|phd|masters|university|college|certificate|pmp/.test(key)) return 'education'
  if (/project|portfolio|repository|github/.test(key)) return 'projects'
  if (/award|honor|language|certification/.test(key) || key.length > 40) return 'certifications'
  return 'skills'
}

const GAP_COPY: Array<[RegExp, (k: string) => string]> = [
  [/^graphql$/, () => "The job asked for GraphQL but the resume doesn't name it. Only add the term with a project that used it — attach evidence first."],
  [/^kubernetes$|^k8s$/, () => "Kubernetes was expected. Don't list it without proof — point to a real deployment or the training that covered it."],
  [/^docker$/, () => "Docker is missable without evidence. Add it only if you actually containerized something."],
  [/^aws$|^gcp$|^azure$/, () => "Cloud platforms carry fabrication risk. Back any claim with a live service or a cert."],
  [/^jest$|^cypress$|^selenium$|^pytest$/, () => "Test tooling was expected. Name it only if you wrote or maintained real tests."],
]

export function gapHint(keyword: string): string {
  for (const [re, copy] of GAP_COPY) {
    if (re.test(keyword.toLowerCase())) return copy(keyword)
  }
  return `"${keyword}" showed up in the job's requirements. Adding it without a real project risks an invented claim — attach evidence before you add it.`
}

export function buildApplicationDna(input: {
  resume: ResumeData
  baseResume: ResumeData
  analysis?: JobAnalysis
  ats?: AtsCheck
  evidence: EvidenceItem[]
  confirmedClaims: ClaimRecord[]
}): {
  resumeVariant: ResumeData
  atsScore: number | null
  genuineScore: number | null
  keywordLedger: KeywordEntry[]
  keywordGaps: string[]
} {
  const variant = input.resume
  const ledger = deriveKeywordLedger({
    variant,
    baseResume: input.baseResume,
    analysis: input.analysis,
    ats: input.ats,
    evidence: input.evidence,
  })
  const genuine = computeGenuineScore({
    resume: variant,
    evidence: input.evidence,
    confirmedClaims: input.confirmedClaims,
  })
  return {
    resumeVariant: variant,
    atsScore: input.ats?.overall_score ?? null,
    genuineScore: genuine.honesty_score,
    keywordLedger: ledger,
    keywordGaps: keywordGaps(ledger),
  }
}