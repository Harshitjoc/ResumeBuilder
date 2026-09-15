import type { ClaimRecord, EvidenceItem, ResumeData, VerifiabilityResult } from '@/types/resume'

const METRIC_WORDS =
  /(?:led|improved|reduced|increased|grew|boosted|cut|drove|raised|delivered|accelerated|optimized|streamlined|automated|scaled|built|designed|handled|managed|resulted|achieved|saved|conversion|revenue|downtime|latency|turnover|retention|throughput|efficiency|responses|signups)\b.{0,60}\d/i

const UNIT_RE = /\d+(?:\.\d+)?\s*(?:%|x|×|hrs?|days?|weeks?|mtbf|ms|users?|customers?|clients?|stores?|revenue|orders|requests|downloads)/i

export function hasMetricClaim(text: string | null | undefined): boolean {
  if (!text) return false
  return UNIT_RE.test(text) || METRIC_WORDS.test(text)
}

function tokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const t of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (t.length > 2) out.add(t)
  }
  return out
}

export function evidenceSupports(
  text: string,
  evidence: EvidenceItem[],
): EvidenceItem | undefined {
  const claim = text.trim().toLowerCase()
  if (!claim) return undefined
  const claimTokens = tokens(claim)
  for (const item of evidence) {
    const clean = item.text.trim().toLowerCase()
    if (!clean) continue
    if (clean.includes(claim) || claim.includes(clean)) return item
    if (claimTokens.size === 0) continue
    const overlap = [...tokens(clean)].filter((t) => claimTokens.has(t)).length
    if (overlap / claimTokens.size >= 0.4) return item
  }
  return undefined
}

export function computeGenuineScore(input: {
  resume?: ResumeData
  confirmedClaims?: ClaimRecord[]
  evidence?: EvidenceItem[]
}): VerifiabilityResult {
  const resume = input.resume
  const claims: Array<{ section: string; text: string }> = []
  if (resume) {
    if (resume.professionalSummary?.trim()) {
      claims.push({ section: 'summary', text: resume.professionalSummary.trim() })
    }
    for (const s of resume.skills ?? []) {
      if (s.trim()) claims.push({ section: 'skills', text: s.trim() })
    }
    for (const e of resume.experience ?? []) {
      for (const b of e.bullets ?? []) {
        if (b.trim()) claims.push({ section: 'experience', text: b.trim() })
      }
    }
    for (const p of resume.projects ?? []) {
      const text = `${p.name}: ${p.description}`.replace(/^:|\s*:\s*$/g, '').trim()
      if (text) claims.push({ section: 'projects', text })
    }
    for (const c of resume.certifications ?? []) {
      if (c.name.trim()) claims.push({ section: 'certifications', text: c.name.trim() })
    }
  }

  const evidence = input.evidence ?? []
  const confirmed = (input.confirmedClaims ?? []).filter(
    (c) => c.verdict === 'verified' || c.verdict === 'confirmed',
  )

  let verified = 0
  let unverifiable = 0
  let neutral = 0
  const flagged: VerifiabilityResult['flagged'] = []

  for (const claim of claims) {
    if (hasMetricClaim(claim.text)) {
      const provedByVault = evidenceSupports(claim.text, evidence)
      const provedByQueue = confirmed.some((c) => {
        const a = c.text.trim().toLowerCase()
        const b = claim.text.trim().toLowerCase()
        return a.includes(b) || b.includes(a)
      })
      if (provedByVault || provedByQueue) {
        verified += 1
      } else {
        unverifiable += 1
        flagged.push({
          section: claim.section,
          text: claim.text,
          reason: 'Quantitative claim without attached proof — add evidence or reframe.',
        })
      }
    } else {
      neutral += 1
    }
  }

  const risky = unverifiable + verified
  const honestyScore = risky > 0 ? Math.round((100 * verified) / risky) : 100

  return {
    total: claims.length,
    verified,
    unverifiable,
    neutral,
    ai_drafted: confirmed.length,
    honesty_score: honestyScore,
    flagged: flagged.slice(0, 20),
  }
}