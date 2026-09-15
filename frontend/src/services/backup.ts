import { useAppStore } from '@/store/appStore'
import type {
  ApplicationRecord,
  ClaimRecord,
  EvidenceItem,
  ReportRecord,
  ResumeData,
  SavedTemplate,
  ShareRecord,
  TargetUser,
  VerificationChange,
} from '@/types/resume'

export const BACKUP_VERSION = 1
export const KDF_ITERATIONS = 150_000

export interface BackupPayload {
  version: number
  resume: ResumeData
  pendingChanges: VerificationChange[]
  evidence: EvidenceItem[]
  confirmedClaims: ClaimRecord[]
  applications: ApplicationRecord[]
  shares: ShareRecord[]
  reports: ReportRecord[]
  customTemplates: SavedTemplate[]
  targetUser: TargetUser | null
  apiKeysMeta: Array<{ provider: string; model: string }>
  exportedAt: string
}

export interface BackupEnvelope {
  v: number
  alg: string
  kdf: string
  saltB64: string
  ivB64: string
  dataB64: string
  integrity: string
  exportedAt: string
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length) as Uint8Array<ArrayBuffer>
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function sha256Hex(data: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function buildPayload(): BackupPayload {
  const s = useAppStore.getState()
  const providers: string[] = []
  if (s.apiKeys?.primaryProvider) providers.push(`${s.apiKeys.primaryProvider}:${s.apiKeys.primaryModel ?? ''}`)
  if (s.apiKeys?.secondaryProvider) providers.push(`${s.apiKeys.secondaryProvider}:${s.apiKeys.secondaryModel ?? ''}`)
  return {
    version: BACKUP_VERSION,
    resume: s.resume,
    pendingChanges: s.pendingChanges,
    evidence: s.evidence,
    confirmedClaims: s.confirmedClaims,
    applications: s.applications,
    shares: s.shares,
    reports: s.reports,
    customTemplates: s.customTemplates,
    targetUser: s.targetUser,
    apiKeysMeta: providers.filter(Boolean).map((p) => {
      const [provider, model] = p.split(':')
      return { provider, model }
    }),
    exportedAt: new Date().toISOString(),
  }
}

export async function encryptBackup(payload: BackupPayload, password: string): Promise<string> {
  const plaintext = enc.encode(JSON.stringify(payload))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const envelope: BackupEnvelope = {
    v: BACKUP_VERSION,
    alg: 'AES-256-GCM',
    kdf: `PBKDF2-SHA256:${KDF_ITERATIONS}`,
    saltB64: toB64(salt.buffer),
    ivB64: toB64(iv.buffer),
    dataB64: toB64(data),
    integrity: await sha256Hex(new Uint8Array(plaintext)),
    exportedAt: payload.exportedAt,
  }
  return JSON.stringify(envelope, null, 2)
}

export function decryptBackup(fileText: string, password: string): Promise<BackupPayload> {
  return (async () => {
    let envelope: BackupEnvelope
    try {
      envelope = JSON.parse(fileText) as BackupEnvelope
    } catch {
      throw new Error('This file is not a valid backup envelope.')
    }
    if (envelope.v !== BACKUP_VERSION) {
      throw new Error(`Unsupported backup version ${envelope.v}.`)
    }
    const salt = fromB64(envelope.saltB64)
    const iv = fromB64(envelope.ivB64)
    const data = fromB64(envelope.dataB64)
    let key: CryptoKey
    try {
      key = await deriveKey(password, salt)
    } catch {
      throw new Error('Could not derive a key from that passphrase.')
    }
    let plaintext: ArrayBuffer
    try {
      plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    } catch {
      throw new Error('Wrong passphrase or corrupted file — nothing was changed.')
    }
    const integrity = await sha256Hex(new Uint8Array(plaintext))
    if (integrity !== (envelope.integrity ?? '')) {
      throw new Error('Integrity check failed — the file may be corrupted.')
    }
    let payload: BackupPayload
    try {
      payload = JSON.parse(dec.decode(plaintext)) as BackupPayload
    } catch {
      throw new Error('Decrypted payload is not valid JSON.')
    }
    return payload
  })()
}

export function mergeByKind(current: BackupPayload, incoming: BackupPayload): BackupPayload {
  const keepNewest = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const map = new Map<string, T>()
    for (const item of [...a, ...b]) {
      const existing = map.get(item.id)
      if (!existing) {
        map.set(item.id, item)
        continue
      }
      const eCreated = (existing as { createdAt?: string }).createdAt ?? ''
      const nCreated = (item as { createdAt?: string }).createdAt ?? ''
      if (!eCreated || nCreated >= eCreated) map.set(item.id, item)
    }
    return Array.from(map.values())
  }
  return {
    ...incoming,
    resume: incoming.resume,
    pendingChanges: keepNewest(current.pendingChanges ?? [], incoming.pendingChanges ?? []),
    evidence: keepNewest(current.evidence ?? [], incoming.evidence ?? []),
    confirmedClaims: keepNewest(current.confirmedClaims ?? [], incoming.confirmedClaims ?? []),
    applications: keepNewest(current.applications ?? [], incoming.applications ?? []),
    shares: keepNewest(current.shares ?? [], incoming.shares ?? []),
    reports: keepNewest(current.reports ?? [], incoming.reports ?? []),
    customTemplates: keepNewest(current.customTemplates ?? [], incoming.customTemplates ?? []),
    apiKeysMeta: (incoming.apiKeysMeta ?? current.apiKeysMeta ?? []).slice(),
  }
}

export function downloadPayload(payload: BackupPayload, plain: boolean, password: string): void {
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = plain
    ? `resume-builder-backup-${stamp}.json`
    : `resume-builder-backup-${stamp}.json`
  if (plain) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  void encryptBackup(payload, password).then((envelope) => {
    const blob = new Blob([envelope], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  })
}