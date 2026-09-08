import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Printer } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ResumePreview from '@/components/ResumePreview'

export default function PreviewPage() {
  const resume = useAppStore((s) => s.resume)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: resume.contact.fullName || 'resume',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Resume Preview</h1>
        <button
          onClick={() => handlePrint()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Printer className="h-4 w-4" /> Print / PDF
        </button>
      </div>

      {resume.contact.fullName ? (
        <div className="mx-auto max-w-[800px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div ref={printRef}>
            <ResumePreview resume={resume} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Your resume looks empty. Head to the Resume Builder to add your details.
        </p>
      )}
    </div>
  )
}
