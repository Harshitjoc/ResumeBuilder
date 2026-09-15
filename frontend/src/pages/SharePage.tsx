import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import {
  FileWarning,
  ShieldCheck,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Eye,
  UserRound,
  ScanSearch,
  MessageCircle,
  BadgeCheck,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ResumePreview from '@/components/ResumePreview'
import { fetchShare } from '@/services/llm'
import type { PublicShareData } from '@/services/llm'
import { computeGenuineScore, hasMetricClaim } from '@/services/verifiability'
import { scoreToBadge } from '@/components/GenuineScoreCard'
import { recruiterChecklist } from '@/services/shadowAts'

export default function SharePage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const shares = useAppStore((s) => s.shares)
  const localShare = shares.find((s) => s.slug === slug)

  const [remote, setRemote] = useState<PublicShareData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [showProof, setShowProof] = useState(false)
  const [showFlags, setShowFlags] = useState(true)

  const recruiterView = searchParams.get('view') === 'recruiter'
  const refParam = searchParams.get('ref')

  useEffect(() => {
    if (refParam && !localStorage.getItem('rb-referrer')) {
      localStorage.setItem('rb-referrer', refParam)
    }
  }, [refParam])

  useEffect(() => {
    if (localShare || notFound) return
    let cancelled = false
    fetchShare(slug ?? '')
      .then((data) => {
        if (!cancelled) setRemote(data)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug, localShare, notFound])

  const share = localShare
    ? {
        name: localShare.name,
        createdAt: localShare.createdAt,
        atsScore: localShare.atsScore,
        resume: localShare.resume,
        evidence: localShare.evidence ?? [],
        heuristicAts: localShare.heuristicAts,
      }
    : remote

  const checklist = useMemo(() => (share ? recruiterChecklist(share.resume) : []), [share?.resume])

  const toggleRecruiter = () => {
    const next = searchParams.get('view') === 'recruiter'
      ? { view: 'public' as const }
      : { view: 'recruiter' as const }
    setSearchParams(next, { replace: true })
  }

  if (!share) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <FileWarning className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <h1 className="text-lg font-semibold text-slate-900">Share link not found</h1>
          <p className="mt-1 text-sm text-slate-500">
            This share link isn't available or has expired.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Go home
          </Link>
        </div>
      </div>
    )
  }

  const honesty = computeGenuineScore({
    resume: share.resume,
    evidence: share.evidence ?? [],
  })
  const badge = scoreToBadge(honesty.honesty_score)
  const proofItems = (share.evidence ?? []).filter((e) => hasMetricClaim(e.text))
  const atsIsHeuristic = share.heuristicAts === true

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{share.name}</h1>
          <p className="text-sm text-slate-500">
            Shared {new Date(share.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleRecruiter}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              recruiterView
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title="Preview how a recruiter will open this resume"
          >
            {recruiterView ? (
              <>
                <UserRound className="h-3.5 w-3.5" /> Candidate view
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> View as recruiter
              </>
            )}
          </button>
          {!recruiterView && (
            <Link
              to={`/share/${slug}?view=recruiter`}
              title="Copy the recruiter link to send as-is"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ScanSearch className="h-3.5 w-3.5" /> Copy recruiter link
            </Link>
          )}
        </div>
      </div>

{!recruiterView && (
    <div className="flex items-center gap-2 print:hidden">
      {refParam && (
        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          <BadgeCheck className="h-3.5 w-3.5" /> Recommended via a Genuine badge — built with verification-first tooling
        </span>
      )}
      <a
        href={(() => {
          const base = `${window.location.origin}/share/${slug}`
          const scoreClause = typeof share.atsScore === 'number'
            ? ` (ATS ${share.atsScore}${atsIsHeuristic ? ' offline estimate' : ''})`
            : ''
          return `https://wa.me/?text=${encodeURIComponent(`My verified resume${scoreClause}: ${base}`)}`
        })()}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
      </a>
    </div>
  )}

  {!recruiterView && (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-white ${badge.className}`}
              title="Share of quantitative claims backed by proof"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> {badge.label} · {honesty.honesty_score}
            </span>
            {typeof share.atsScore === 'number' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  ATS score{atsIsHeuristic ? ' (heuristic)' : ''}
                </span>
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${
                    share.atsScore >= 60 ? 'bg-emerald-500' : share.atsScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                >
                  {share.atsScore}
                </span>
              </div>
            )}
          </div>

          {proofItems.length > 0 && (
            <button
              onClick={() => setShowProof((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left print:hidden"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <FileCheck2 className="h-4 w-4 text-emerald-600" />
                Proof attached — {proofItems.length}
                {proofItems.length === 1 ? ' claim backed by evidence' : ' claims backed by evidence'}
              </span>
              {showProof ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
          )}

          {showProof && proofItems.length > 0 && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 print:hidden">
              <p className="eyebrow mb-2">Evidence vault</p>
              {proofItems.map((e, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                  <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>{e.text}</span>
                </div>
              ))}
              <p className="mt-2 text-xs text-slate-400">Qualitative claims on this resume are the candidate's own words and are not generated by AI.</p>
            </div>
          )}
        </>
      )}

      {recruiterView && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:hidden">
          <button
            onClick={() => setShowFlags((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ScanSearch className="h-4 w-4 text-blue-600" />
              What an ATS would flag
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  checklist.some((c) => c.severity === 'error')
                    ? 'bg-red-100 text-red-700'
                    : checklist.some((c) => c.severity === 'warning')
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {checklist.filter((c) => c.severity === 'error').length} blockers ·{' '}
                {checklist.filter((c) => c.severity === 'warning').length} warnings
              </span>
            </span>
            {showFlags ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {showFlags && (
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {checklist.map((item, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                    item.severity === 'error'
                      ? 'bg-red-50 text-red-700'
                      : item.severity === 'warning'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {item.severity === 'error' ? '✕' : item.severity === 'warning' ? '◯' : '✓'}
                  </span>
                  <span>
                    <span className="font-semibold">{item.title}</span>
                    <span className="block text-[11px] opacity-80">{item.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <ResumePreview resume={share.resume} />
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400 print:hidden">
        <ShieldCheck className="h-3.5 w-3.5" />
        {recruiterView
          ? `Shared resume · ${checklist.filter((c) => c.severity === 'error').length} blockers flagged`
          : 'Powered by ResumeBuilder — built with verified, authentic claims'}
      </p>
    </div>
  )
}