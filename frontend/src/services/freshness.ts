import type { ApplicationRecord, EvidenceItem } from '@/types/resume'

const DAY_MS = 24 * 60 * 60 * 1000

function ageDays(date: string, now: Date): number {
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return 0
  return Math.floor((now.getTime() - t) / DAY_MS)
}

export interface EvidenceFreshness {
  stale: string[]
  aging: string[]
  fresh: number
}

export function evidenceFreshness(evidence: EvidenceItem[], now: Date = new Date()): EvidenceFreshness {
  const stale: string[] = []
  const aging: string[] = []
  let fresh = 0
  for (const item of evidence) {
    if (!item.createdAt) {
      fresh += 1
      continue
    }
    const days = ageDays(item.createdAt, now)
    if (days > 365) stale.push(item.id)
    else if (days >= 180) aging.push(item.id)
    else fresh += 1
  }
  return { stale, aging, fresh }
}

export type ApplicationStage = 'active' | 'cooldown' | 'archive'

export interface ApplicationDecay {
  appId: string
  stage: ApplicationStage
  days: number
  reason: string
}

const TERMINAL_LIMIT = 60
const STALE_MOVE_LIMIT = 45
const SAVED_LIMIT = 7

export function applicationDecay(
  applications: ApplicationRecord[],
  now: Date = new Date(),
): Map<string, ApplicationDecay> {
  const result = new Map<string, ApplicationDecay>()
  for (const app of applications) {
    const days = ageDays(app.appliedAt, now)
    let decay: ApplicationDecay | null = null
    if (app.status === 'rejected' && days >= TERMINAL_LIMIT && !app.decayed) {
      decay = { appId: app.id, stage: 'archive', days, reason: 'rejected 60+ days ago — close the loop' }
    } else if (app.status === 'saved' && days >= SAVED_LIMIT) {
      decay = { appId: app.id, stage: 'cooldown', days, reason: `saved ${days} days ago — still tracking?` }
    } else if (app.status !== 'saved' && app.status !== 'rejected' && days >= STALE_MOVE_LIMIT) {
      decay = { appId: app.id, stage: 'cooldown', days, reason: `${days} days without a move — update status or close the loop` }
    }
    if (decay) result.set(app.id, decay)
  }
  return result
}

export function freshnessLabel(status: 'stale' | 'aging' | 'fresh'): string {
  if (status === 'stale') return 'stale proof · add a recent update'
  if (status === 'aging') return 'aging proof · worth refreshing'
  return 'proof current'
}