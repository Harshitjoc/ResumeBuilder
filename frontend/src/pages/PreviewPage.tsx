import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import { Printer } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ResumePreview from '@/components/ResumePreview'
import ConversionModal from '@/components/ConversionModal'
import { sessionIsVisitor } from '@/services/session'

export default function PreviewPage() {
  const resume = useAppStore((s) => s.resume)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const [conversionOpen, setConversionOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: resume.contact.fullName || 'resume',
  })

  const handleDownloadClick = () => {
    if (sessionIsVisitor(sessionStatus)) {
      setConversionOpen(true)
      return
    }
    handlePrint()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">Live preview</p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Resume Preview</h1>
        </div>
        <button
          onClick={handleDownloadClick}
          className="btn-pencil"
        >
          <Printer className="h-4 w-4" /> Print / PDF
        </button>
      </div>

      {conversionOpen && <ConversionModal onClose={() => setConversionOpen(false)} />}

      {resume.contact.fullName ? (
        <div className="sheet mx-auto max-w-[800px] p-8">
          <div ref={printRef}>
            <ResumePreview resume={resume} />
          </div>
        </div>
      ) : (
        <div className="sheet border-dashed bg-transparent p-10 text-center">
          <p className="text-sm text-slate-500">
            Your resume looks empty.{' '}
            <Link to="/builder" className="font-semibold text-blue-700 underline decoration-blue-400 underline-offset-2">
              Start building
            </Link>
            {' '}to see it on paper.
          </p>
        </div>
      )}
    </div>
  )
}