import { useRef, useState } from 'react'
import { Download, Upload, Lock, FileJson, ShieldCheck, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { buildPayload, decryptBackup, encryptBackup, mergeByKind, type BackupPayload } from '@/services/backup'

function exportFile(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BackupPage() {
  const applyPayload = (payload: BackupPayload, replace: boolean) => {
    const s = useAppStore.getState()
    const final = replace ? payload : mergeByKind(buildPayload(), payload)
    s.setResume(final.resume)
    s.setPendingChanges(final.pendingChanges ?? [])
    s.setEvidence(final.evidence ?? [])
    s.setConfirmedClaims(final.confirmedClaims ?? [])
    s.setApplications(final.applications ?? [])
    s.setShares(final.shares ?? [])
    s.setReports(final.reports ?? [])
    s.setTargetUser(final.targetUser ?? null)
  }

  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'replace' | 'merge'>('replace')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExportEncrypted = async () => {
    if (pass.length < 8) {
      setError('Use a passphrase of at least 8 characters so the backup survives brute-force attempts.')
      setNotice('')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const envelope = await encryptBackup(buildPayload(), pass)
      const stamp = new Date().toISOString().slice(0, 10)
      exportFile(envelope, `resume-builder-backup-${stamp}.json`)
      setNotice('Encrypted backup exported. Keep the passphrase safe — it cannot be recovered.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const handleExportPlain = () => {
    setError('')
    setNotice('')
    exportFile(JSON.stringify(buildPayload(), null, 2), `resume-builder-backup-${new Date().toISOString().slice(0, 10)}.json`)
    setNotice('Plain JSON exported — not encrypted. Handle the file with care.')
  }

  const handleRestore = async (file: File | null) => {
    if (!file) return
    if (pass.length < 8) {
      setError('Enter the passphrase you used when exporting (minimum 8 characters).')
      setNotice('')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const text = await file.text()
      const payload = await decryptBackup(text, pass)
      applyPayload(payload, mode === 'replace')
      setNotice(
        mode === 'replace'
          ? `Restored ${new Date(payload.exportedAt).toLocaleString()} backup (${payload.applications.length} applications, ${payload.evidence.length} evidence items).`
          : 'Merged backup, keeping the newest record per item.'
      )
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Backup &amp; security</h1>
        <p className="text-sm text-slate-500">
          Portable, encrypted snapshots of your resume, evidence, applications and reports. Nothing is uploaded — the backup is encrypted
          locally and never leaves your browser.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900">Export backup</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          API keys are never included — only provider/model metadata. Re-add keys after restoring.
        </p>
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Passphrase (min 8 characters)</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="Passphrase"
              />
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPass ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            onClick={handleExportEncrypted}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Lock className="h-4 w-4" /> {busy ? 'Encrypting...' : 'Export encrypted'}
          </button>
          <button
            onClick={handleExportPlain}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title="Not encrypted — for manual moves only"
          >
            <FileJson className="h-4 w-4" /> Plain JSON
          </button>
          <Download className="h-4 w-4 text-slate-300" />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900">Restore backup</h2>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} className="accent-slate-900" />
            Replace everything
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} className="accent-slate-900" />
            Keep newest per item
          </label>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Same passphrase used at export</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="Passphrase"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="block w-full max-w-[260px] text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            onChange={(e) => void handleRestore(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          The restore is atomic: a wrong passphrase or corrupted file changes nothing.
        </p>
      </section>

      {notice && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}