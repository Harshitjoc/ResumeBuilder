import { getAccessToken, isSupabaseConfigured } from '@/services/supabase'
import { getClientKey } from '@/services/clientKey'

const BASE = import.meta.env.VITE_API_URL || ''

const TOKEN_KEY = 'rb-admin-token'
const LEGACY_TOKEN = '' // legacy ADMIN_TOKEN path only used when Supabase is absent

async function authHeaders(): Promise<{ [k: string]: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  headers['X-Client-Key'] = getClientKey()
  if (isSupabaseConfigured) {
    const token = await getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else {
    const token = sessionStorage.getItem(TOKEN_KEY) ?? LEGACY_TOKEN
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const parsed = JSON.parse(text)
      const detail = parsed?.detail
      message = typeof detail === 'string' ? detail : detail?.detail ?? text
    } catch {
      /* keep raw */
    }
    throw new Error(message || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  const headers = await authHeaders()
  return handle<T>(await fetch(`${BASE}${path}`, { method: 'GET', headers }))
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders()
  return handle<T>(
    await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: body === undefined ? null : JSON.stringify(body),
    }),
  )
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders()
  return handle<T>(
    await fetch(`${BASE}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) }),
  )
}

export interface AdminUser {
  id: string
  full_name: string | null
  role: string | null
  plan: string | null
  plan_expires_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PaginatedUsers {
  users: AdminUser[]
  total: number
  page: number
  pageSize: number
}

export interface AdminSettings {
  payment?: Record<string, unknown>
  quotas?: Record<string, unknown>
  features?: Record<string, unknown>
  brand?: Record<string, unknown>
}

export interface AuditLogRow {
  id: string
  actor_user_id: string | null
  actor_label: string | null
  action: string
  target_type: string | null
  target_id: string | null
  before_data: unknown
  after_data: unknown
  reason: string | null
  ip: string | null
  created_at: string | null
}

export interface PaginatedAudit {
  logs: AuditLogRow[]
  total: number
  page: number
  pageSize: number
}

export interface Kpis {
  totalUsers: number
  proUsers: number
  pendingPayments: number
  todayLlmCalls: number
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function hasAdminToken(): boolean {
  return Boolean(sessionStorage.getItem(TOKEN_KEY))
}

export const listUsers = (opts: { search?: string; role?: string; page?: number; pageSize?: number } = {}) => {
  const params = new URLSearchParams()
  if (opts.search) params.set('search', opts.search)
  if (opts.role) params.set('role', opts.role)
  params.set('page', String(opts.page ?? 1))
  params.set('page_size', String(opts.pageSize ?? 25))
  return get<PaginatedUsers>(`/api/admin/users?${params.toString()}`)
}

export const setUserPlan = (userId: string, plan: string, months?: number) =>
  post<{ ok: boolean; plan_expires_at?: string }>(
    `/api/admin/users/${userId}/plan`,
    { plan, months: months ?? undefined },
  )

export const setUserBan = (userId: string, banned: boolean, reason?: string) =>
  post<{ ok: boolean; role: string }>(`/api/admin/users/${userId}/ban`, { banned, reason: reason ?? undefined })

export const deleteUser = (userId: string) =>
  post<{ ok: boolean }>(`/api/admin/users/${userId}/delete`)

export const bulkDeleteUsers = (ids: string[]) =>
  post<{ ok: boolean; deleted: number }>('/api/admin/users/bulk-delete', { ids })

export const getSettings = () => get<{ settings: AdminSettings }>('/api/admin/settings')

export const updateSettings = (patch: AdminSettings) =>
  put<{ settings: AdminSettings }>('/api/admin/settings', patch)

export const getKpis = () => get<{ kpis: Kpis }>('/api/admin/kpis')

export const getAuditLog = (page = 1, pageSize = 25) =>
  get<PaginatedAudit>(`/api/admin/audit?page=${page}&page_size=${pageSize}`)