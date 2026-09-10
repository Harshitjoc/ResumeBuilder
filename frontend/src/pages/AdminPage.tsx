import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ShieldCheck,
  KeyRound,
  Loader2,
  RefreshCw,
  Users,
  Settings,
  BarChart3,
  ScrollText,
  Wallet,
  CheckCircle2,
  XCircle,
  Ban,
  Trash2,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { isSupabaseConfigured } from '@/services/supabase'
import {
  listUsers,
  setUserPlan,
  setUserBan,
  deleteUser,
  getSettings,
  updateSettings,
  getKpis,
  getAuditLog,
  setAdminToken,
  type AdminSettings,
  type AuditLogRow,
  type Kpis,
} from '@/services/adminApi'
import {
  listPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest,
  type PaymentRequestItem,
} from '@/services/llm'
import { refreshPlan } from '@/services/plan'

type Tab = 'overview' | 'users' | 'payments' | 'settings' | 'audit'

const STATUS_STYLES: Record<PaymentRequestItem['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function AdminPage() {
  const role = useAppStore((s) => s.role)
  const [tab, setTab] = useState<Tab>('overview')
  const [legacyToken, setLegacyToken] = useState(() => sessionStorage.getItem('rb-admin-token') ?? '')
  const [error, setError] = useState('')

  const adminMode = isSupabaseConfigured
  const blocked = adminMode && role !== null && role !== 'admin'

  if (blocked) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Admin access required</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your account is not an administrator. If you expected access, contact support.
        </p>
      </div>
    )
  }

  if (!adminMode && !legacyToken) {
    return <TokenGate value={legacyToken} onChange={setLegacyToken} />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-slate-600" /> Admin panel
        </h1>
        {!adminMode && (
          <div className="flex items-center gap-2">
            <input
              type="password"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="Admin token"
              value={legacyToken}
              onChange={(e) => {
                const v = e.target.value
                setLegacyToken(v)
                setAdminToken(v.trim())
                setError('')
              }}
            />
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <TabBar tab={tab} onChange={setTab} />

      {tab === 'overview' && <OverviewTab onError={setError} />}
      {tab === 'users' && <UsersTab onError={setError} />}
      {tab === 'payments' && <PaymentsTab adminMode={adminMode} onError={setError} />}
      {tab === 'settings' && <SettingsTab onError={setError} />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

// ── pieces ────────────────────────────────────────────────────────────────

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: Array<[Tab, string, typeof BarChart3]> = [
    ['overview', 'Overview', BarChart3],
    ['users', 'Users', Users],
    ['payments', 'Payments', Wallet],
    ['settings', 'Settings', Settings],
    ['audit', 'Audit', ScrollText],
  ]
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm">
      {tabs.map(([key, label, Icon]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

function useLoad<T>(loader: () => Promise<T>) {
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await loaderRef.current())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, load }
}

function errorNote(error: string) {
  return error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null
}

function OverviewTab({ onError }: { onError: (s: string) => void }) {
  const { data, loading, error, load } = useLoad<Kpis>(async () => (await getKpis()).kpis)
  useEffect(() => {
    load()
  }, [load])

  const cards = data
    ? [
        ['Total users', data.totalUsers],
        ['Pro users', data.proUsers],
        ['Pending payments', data.pendingPayments],
        ['LLM calls today', data.todayLlmCalls],
      ]
    : []

  void onError

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">Key metrics</h2>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {errorNote(error)}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function UsersTab({ onError }: { onError: (s: string) => void }) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const { data, loading, error, load } = useLoad(() => listUsers(query || undefined, roleFilter || undefined))

  useEffect(() => {
    load()
  }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setActing('busy')
    try {
      await fn()
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="banned">Banned</option>
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Search
        </button>
      </div>

      {errorNote(error)}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{u.full_name || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.role === 'admin'
                        ? 'bg-violet-100 text-violet-700'
                        : u.role === 'banned'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {u.role || 'user'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.plan === 'pro' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {u.plan || 'free'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {u.role !== 'admin' && (
                      <PlanMenu userId={u.id} current={u.plan === 'pro' ? 'pro' : 'free'} disabled={acting === u.id} onAct={run} />
                    )}
                    {u.role !== 'admin' && (
                      <button
                        onClick={() =>
                          run(() => setUserBan(u.id, u.role !== 'banned', 'Manually banned from admin panel'))
                        }
                        disabled={acting === u.id}
                        title={u.role === 'banned' ? 'Unban' : 'Ban'}
                        className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete user ${u.full_name || u.id}? This cannot be undone.`))
                          run(() => deleteUser(u.id))
                      }}
                      disabled={acting === u.id}
                      title="Delete"
                      className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(data?.users?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlanMenu({
  userId,
  current,
  disabled,
  onAct,
}: {
  userId: string
  current: 'free' | 'pro'
  disabled: boolean
  onAct: (fn: () => Promise<unknown>) => void
}) {
  const [busy, setBusy] = useState(false)
  const [months, setMonths] = useState(12)
  const act = async (plan: string) => {
    setBusy(true)
    try {
      await onAct(() => setUserPlan(userId, plan, plan === 'pro' ? months : undefined))
      if (plan === 'pro') await refreshPlan()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-1">
      {current === 'free' && (
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          disabled={disabled || busy}
          className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs"
        >
          <option value={1}>1 mo</option>
          <option value={12}>12 mo</option>
          <option value={24}>24 mo</option>
        </select>
      )}
      <button
        onClick={() => act(current === 'pro' ? 'free' : 'pro')}
        disabled={disabled || busy}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : current === 'pro' ? 'Revoke' : 'Grant Pro'}
      </button>
    </div>
  )
}

function PaymentsTab({ adminMode, onError }: { adminMode: boolean; onError: (s: string) => void }) {
  const [acting, setActing] = useState<string | null>(null)
  const { data, loading, load } = useLoad(async () => {
    const token = adminMode ? '' : sessionStorage.getItem('rb-admin-token') ?? ''
    return listPaymentRequests(token)
  })

  useEffect(() => {
    load()
  }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setActing('busy')
      await fn()
      await load()
      await refreshPlan()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(null)
    }
  }

  const requests = data?.requests ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">UTR payment requests</h2>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {requests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          No payment requests yet. New UTR submissions from /upgrade will appear here.
        </div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {r.name || r.email || 'Anonymous'}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  UTR <span className="font-mono font-medium text-slate-700">{r.utr}</span>
                  {r.amount != null && ` · amount ${r.amount}`}
                  {r.email && ` · ${r.email}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(r.createdAt).toLocaleString()}
                  {r.userId && ' · signed in'}
                </p>
              </div>
              {r.status === 'pending' && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => run(() => approvePaymentRequest(r.id, adminMode ? '' : sessionStorage.getItem('rb-admin-token') ?? ''))}
                    disabled={acting === r.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {acting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                  <button
                    onClick={() => run(() => rejectPaymentRequest(r.id, adminMode ? '' : sessionStorage.getItem('rb-admin-token') ?? ''))}
                    disabled={acting === r.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              )}
              {r.status !== 'pending' && <RefreshCw className="h-4 w-4 shrink-0 text-slate-300" />}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function SettingsTab({ onError }: { onError: (s: string) => void }) {
  const [form, setForm] = useState<AdminSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { data, loading, load } = useLoad(getSettings)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (data?.settings) setForm(data.settings)
  }, [data])

  const setNested = (section: keyof AdminSettings, key: string, value: unknown) => {
    setSaved(false)
    setForm((prev) => {
      const current = prev ?? {}
      const sectionData = { ...((current[section] as Record<string, unknown>) ?? {}) }
      sectionData[key] = value
      return { ...current, [section]: sectionData } as AdminSettings
    })
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    setSaved(false)
    try {
      await updateSettings(form)
      setSaved(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !form) return <p className="text-sm text-slate-400">Loading settings...</p>

  const sections: Array<[keyof AdminSettings, string]> = [
    ['payment', 'Payment'],
    ['quotas', 'Quotas & limits'],
    ['features', 'Feature flags'],
    ['brand', 'Branding'],
  ]

  return (
    <div className="space-y-4">
      {sections.map(([section, label]) => {
        const data = (form?.[section] as Record<string, unknown> | undefined) ?? {}
        const fields = section === 'payment'
          ? ['upi_id', 'upi_payee_name', 'payment_amount', 'currency', 'subscription_months']
          : section === 'quotas'
            ? ['free_daily_llm', 'max_upload_mb']
            : section === 'features'
              ? ['public_shares', 'cover_letters', 'interview_prep', 'application_tracker']
              : ['product_name']
        return (
          <div key={section} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">{label}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((key) => (
                <label key={key} className="block text-xs text-slate-500">
                  {key}
                  <input
                    value={String(data[key] ?? '')}
                    onChange={(e) =>
                      setNested(
                        section,
                        key,
                        /^(payment_amount|subscription_months|free_daily_llm|max_upload_mb)$/.test(key)
                          ? Number(e.target.value) || 0
                          : e.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
          Save settings
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </div>
  )
}

function AuditTab() {
  const { data, loading, load } = useLoad<{ logs: AuditLogRow[] }>(() => getAuditLog(100))
  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">Recent admin actions</h2>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(data?.logs ?? []).map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.actor_label ?? row.actor_user_id ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.action}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.target_id ?? row.target_type ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{row.reason ?? '—'}</td>
              </tr>
            ))}
            {(data?.logs?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TokenGate({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-slate-600" />
        <h1 className="text-lg font-semibold text-slate-900">Admin access</h1>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Enter the admin token from the backend .env (this mode is for local development without Supabase).
      </p>
      <input
        type="password"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        placeholder="Admin token"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setAdminToken(e.target.value.trim())
        }}
      />
    </div>
  )
}