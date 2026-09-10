import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { FileWarning } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ResumePreview from '@/components/ResumePreview'

export default function SharePage() {
  const { slug } = useParams<{ slug: string }>()
  const shares = useAppStore((s) => s.shares)
  const share = shares.find((s) => s.slug === slug)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{share.name}</h1>
          <p className="text-sm text-slate-500">
            Shared {new Date(share.createdAt).toLocaleDateString()}
          </p>
        </div>
        {typeof share.atsScore === 'number' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">ATS score</span>
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

      <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <ResumePreview resume={share.resume} />
      </div>
    </div>
  )
}
