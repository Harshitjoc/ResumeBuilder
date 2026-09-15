import { useEffect, useState } from 'react'
import {
  User,
  Crown,
  KeyRound,
  Download,
  Trash2,
  LogOut,
  Loader2,
  FileText,
  History,
  Plug,
  Copy,
  Check,
  ImagePlus,
  X,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ApiKeyManager from '@/components/ApiKeyManager'
import {
  isSupabaseConfigured,
  signOut,
  updatePassword,
  updateUserProfile,
} from '@/services/supabase'
import { myPaymentRequests, deleteAccount, type PaymentRequestItem } from '@/services/llm'
import { createExtSyncToken } from '@/services/ext'
import { refreshPlan } from '@/services/plan'
import { resetCloudSyncState } from '@/services/cloudSync'
import { setUserId } from '@/services/clientKey'
import { Link } from 'react-router-dom'

export default function AccountPage() {
  const sessionUser = useAppStore((s) => s.sessionUser)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const plan = useAppStore((s) => s.plan)
  const clearSession = useAppStore((s) => s.clearSession)

  const [requests, setRequests] = useState<PaymentRequestItem[] | null>(null)
  const [password, setPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [extToken, setExtToken] = useState('')
  const [extError, setExtError] = useState('')
  const [extLoading, setExtLoading] = useState(false)
  const [extCopied, setExtCopied] = useState(false)
  const [profileName, setProfileName] = useState(sessionUser?.full_name ?? '')
  const [profilePhone, setProfilePhone] = useState(sessionUser?.phone ?? '')
  const [profileLocation, setProfileLocation] = useState(sessionUser?.location ?? '')
  const [profileHeadline, setProfileHeadline] = useState(sessionUser?.headline ?? '')
  const [profileAvatar, setProfileAvatar] = useState(sessionUser?.avatarUrl ?? '')
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    if (!sessionUser) return
    setProfileName(sessionUser.full_name ?? '')
    setProfilePhone(sessionUser.phone ?? '')
    setProfileLocation(sessionUser.location ?? '')
    setProfileHeadline(sessionUser.headline ?? '')
    setProfileAvatar(sessionUser.avatarUrl ?? '')
  }, [sessionUser?.id, sessionUser?.full_name, sessionUser?.phone, sessionUser?.location, sessionUser?.headline, sessionUser?.avatarUrl])

  const resizeAvatar = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read that file'))
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('Could not read that image'))
        img.onload = () => {
          const size = 128
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Image processing is not supported here'))
          const scale = Math.min(size / img.width, size / img.height)
          const w = img.width * scale
          const h = img.height * scale
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.src = String(reader.result)
      }
      reader.readAsDataURL(file)
    })

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileErr('')
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setProfileAvatar(await resizeAvatar(file))
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Could not process that image')
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionUser) return
    setProfileMsg('')
    setProfileErr('')
    setProfileSaving(true)
    try {
      await updateUserProfile(sessionUser.id, {
        fullName: profileName.trim() || null,
        phone: profilePhone.trim() || null,
        location: profileLocation.trim() || null,
        headline: profileHeadline.trim() || null,
        avatarUrl: profileAvatar || null,
      })
      useAppStore.getState().setSession(
        {
          ...sessionUser,
          full_name: profileName.trim() || null,
          phone: profilePhone.trim() || null,
          location: profileLocation.trim() || null,
          headline: profileHeadline.trim() || null,
          avatarUrl: profileAvatar || null,
        },
        sessionUser.is_anonymous ? 'anonymous' : 'signed-in',
      )
      setProfileMsg('Profile saved.')
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleExtToken = async () => {
    setExtError('')
    setExtCopied(false)
    setExtLoading(true)
    try {
      const result = await createExtSyncToken()
      setExtToken(result.token)
    } catch (err) {
      setExtError(err instanceof Error ? err.message : 'Could not generate a sync token')
    } finally {
      setExtLoading(false)
    }
  }

  const handleCopyToken = async () => {
    if (!extToken) return
    try {
      await navigator.clipboard.writeText(extToken)
      setExtCopied(true)
      setTimeout(() => setExtCopied(false), 2000)
    } catch {
      setExtError('Could not copy to clipboard — select the token and copy it manually.')
    }
  }

  const loadRequests = async () => {
    try {
      const res = await myPaymentRequests()
      setRequests(res.requests ?? [])
    } catch {
      setRequests([])
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg('')
    setPwErr('')
    if (password.length < 10) {
      setPwErr('Use a password with at least 10 characters.')
      return
    }
    setPwSaving(true)
    try {
      await updatePassword(password)
      setPwMsg('Password updated.')
      setPassword('')
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setPwSaving(false)
    }
  }

  const handleExport = () => {
    const s = useAppStore.getState()
    const data = {
      exportedAt: new Date().toISOString(),
      resume: s.resume,
      reports: s.reports,
      evidence: s.evidence,
      applications: s.applications,
      shares: s.shares,
      targetUser: s.targetUser,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resume-builder-backup.json`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(true)
    setTimeout(() => setExporting(false), 600)
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete your account and all your data? This cannot be undone.')) return
    if (!window.confirm('Are you sure? All resumes, reports, and applications will be permanently removed.')) return
    setDeleting(true)
    try {
      await deleteAccount()
    } catch {
      /* user may not have backend/supabase connected — still clear locally */
    } finally {
      await signOut()
      clearSession()
      setUserId(null)
      resetCloudSyncState()
      localStorage.removeItem('resume-builder-storage')
      setDeleting(false)
    }
  }

  const handleSignOutEverywhere = async () => {
    await signOut('global')
    clearSession()
    setUserId(null)
    resetCloudSyncState()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <User className="h-5 w-5 text-slate-600" /> Account
      </h1>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <User className="h-4 w-4 text-slate-500" /> Profile
        </h2>
        <form onSubmit={handleSaveProfile}>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl font-semibold text-slate-400">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  (profileName.trim() || sessionUser?.full_name || '?').charAt(0).toUpperCase()
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                <ImagePlus className="h-3 w-3" />
                Upload photo
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              </label>
              {profileAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    setProfileAvatar('')
                    setProfileErr('')
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-600"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <label className="block text-xs text-slate-500">
                Full name *
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </label>
              <div className="text-xs text-slate-500">
                Email
                <div className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
                  {sessionUser?.email ?? '(no email address)'}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Optional
                <span className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-slate-500">
                  Phone
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Location
                  <input
                    type="text"
                    value={profileLocation}
                    onChange={(e) => setProfileLocation(e.target.value)}
                    placeholder="Bengaluru, India"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block text-xs text-slate-500">
                Job title / headline
                <input
                  type="text"
                  value={profileHeadline}
                  onChange={(e) => setProfileHeadline(e.target.value)}
                  placeholder="e.g. Frontend Engineer"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </label>

              <p className="text-[11px] text-slate-400">
                Your name, phone, and headline pre-fill new resumes. Everything here is saved to your account.
              </p>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save profile
                </button>
                {profileMsg && <p className="text-xs text-emerald-600">{profileMsg}</p>}
                {profileErr && <p className="text-xs text-red-600">{profileErr}</p>}
              </div>
            </div>
          </div>
        </form>
      </div>

      {!isSupabaseConfigured && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Cloud features are off — frontend Supabase env vars are not set.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{sessionUser?.full_name || sessionUser?.email || 'Guest'}</p>
            <p className="text-xs text-slate-500">
              {sessionUser?.email ?? '(anonymous session)'} · {sessionStatus}
              {sessionUser?.is_anonymous ? ' — create or claim an account to download PDFs' : ''}
            </p>
          </div>
          <Link
            to="/upgrade"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <Crown className="h-3.5 w-3.5" />
            {plan.tier === 'pro' ? 'Manage Pro' : 'Upgrade'}
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Plan</p>
            <p className={`text-lg font-bold ${plan.tier === 'pro' ? 'text-emerald-600' : 'text-slate-900'}`}>
              {plan.tier === 'pro' ? 'Pro' : 'Free'}
            </p>
            {plan.expiresAt && (
              <p className="text-xs text-slate-500">Valid until {new Date(plan.expiresAt).toLocaleDateString()}</p>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Today&apos;s quota</p>
            <p className="text-lg font-bold text-slate-900">
              {plan.quotaRemaining === null ? 'Unlimited' : `${plan.quotaRemaining} left`}
            </p>
            {plan.quotaLimit !== null && <p className="text-xs text-slate-500">of {plan.quotaLimit} LLM calls/day</p>}
          </div>
        </div>
        <button
          onClick={() => {
            void loadRequests()
          }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <History className="h-3.5 w-3.5" />
          {requests === null ? 'Show payment history' : 'Refresh payment history'}
        </button>
        {requests && (
          <div className="mt-3 space-y-2">
            {requests.length === 0 ? (
              <p className="text-sm text-slate-400">No payment requests found.</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-mono text-slate-700">{r.utr}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : r.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {plan.tier === 'pro' && isSupabaseConfigured && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Plug className="h-4 w-4 text-slate-500" /> Chrome extension sync
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Pull your saved resumes into the Chrome extension so you can autofill job application forms straight from
            your account.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleExtToken}
              disabled={extLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {extLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              {extToken ? 'Generate a new token' : 'Generate sync token'}
            </button>
            {extToken && (
              <>
                <input
                  readOnly
                  value={extToken}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 focus:outline-none"
                />
                <button
                  onClick={handleCopyToken}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {extCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {extCopied ? 'Copied' : 'Copy'}
                </button>
              </>
            )}
          </div>
          {extToken && (
            <p className="mt-2 text-xs text-amber-700">
              Valid for 5 minutes. Paste it into the extension popup under “Sync from account”. Treat it like a
              password — anyone with it can import your resumes.
            </p>
          )}
          {extError && <p className="mt-2 text-xs text-red-600">{extError}</p>}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FileText className="h-4 w-4 text-slate-500" /> API keys (stored only in your browser)
        </h2>
        <ApiKeyManager />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <KeyRound className="h-4 w-4 text-slate-500" /> Security
        </h2>
        <form onSubmit={handleChangePassword} className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 text-xs text-slate-500">
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 10 characters"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={pwSaving}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Change password
          </button>
        </form>
        {pwErr && <p className="mt-2 text-xs text-red-600">{pwErr}</p>}
        {pwMsg && <p className="mt-2 text-xs text-emerald-600">{pwMsg}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleSignOutEverywhere}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out everywhere
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Data</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export data (JSON)
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete account
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Export includes your resume, reports, evidence, applications, shared links, and persona. Deleting your account
          removes your profile, all owned data, and your Supabase identity permanently.
        </p>
        <button
          onClick={async () => {
            await refreshPlan()
          }}
          className="mt-3 text-xs text-slate-400 underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
        >
          Resync membership status
        </button>
      </div>
    </div>
  )
}
