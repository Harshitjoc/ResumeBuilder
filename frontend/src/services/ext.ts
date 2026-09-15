import { getClientKey, getUserId } from '@/services/clientKey'
import { getAccessToken } from '@/services/supabase'

const BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers || {})
  headers.set('X-Client-Key', getClientKey())
  const userId = getUserId()
  if (userId) headers.set('X-User-Id', userId)
  if (!headers.has('Authorization')) {
    const token = await getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = `Request failed: ${res.status}`
    try {
      const parsed = JSON.parse(text)
      const detail = parsed?.detail
      if (typeof detail === 'string') message = detail
      else if (detail && typeof detail.detail === 'string') message = detail.detail
    } catch {
      if (text) message = text
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export interface ExtSyncTokenResult {
  token: string
  expiresAt: string
}

export interface ExtResumeEntry {
  tag: string
  resume: Record<string, unknown>
}

export interface ExtResumesResult {
  resumes: ExtResumeEntry[]
}

export function createExtSyncToken(): Promise<ExtSyncTokenResult> {
  return request<ExtSyncTokenResult>('/api/ext/sync-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}