import { Link } from 'react-router-dom'
import { FileText, Briefcase, ListChecks, ShieldCheck, KeyRound, Upload, Sparkles, ClipboardCheck, Target, LayoutGrid, ArrowRight } from 'lucide-react'
import { PersonaPicker } from '@/components/PersonaPicker'

const FEATURES = [
  {
    eyebrow: 'Import',
    icon: <Upload className="h-6 w-6" />,
    title: 'Import any resume',
    desc: 'Upload a PDF, Word, or TXT resume (or paste text) and the AI parses it into editable, structured data you verify yourself.',
  },
  {
    eyebrow: 'Verify',
    icon: <ListChecks className="h-6 w-6" />,
    title: 'Verification Queue',
    desc: 'Every AI change is shown side by side with the original. Approve, reject, or edit — nothing is automatic.',
  },
  {
    eyebrow: 'Score',
    icon: <Sparkles className="h-6 w-6" />,
    title: 'Resume analysis',
    desc: 'Get a 0–100 score with ATS, impact, and structure notes — plus a job-fit score when you paste a job posting.',
  },
  {
    eyebrow: 'ATS',
    icon: <ClipboardCheck className="h-6 w-6" />,
    title: 'ATS checker',
    desc: 'See how your resume scores against applicant tracking systems with keyword, structure, and formatting breakdowns.',
  },
  {
    eyebrow: 'Draft',
    icon: <FileText className="h-6 w-6" />,
    title: 'Cover letters',
    desc: 'Generate tailored cover letters for any job posting, matching your resume to the role.',
  },
  {
    eyebrow: 'Prep',
    icon: <Target className="h-6 w-6" />,
    title: 'Interview prep',
    desc: 'Get likely interview questions, company research points, talking points, and questions to ask — all tailored to you.',
  },
  {
    eyebrow: 'Track',
    icon: <LayoutGrid className="h-6 w-6" />,
    title: 'Application tracking',
    desc: 'Track every application from saved to offer with a visual Kanban board. Never lose track of where you are.',
  },
  {
    eyebrow: 'Vault',
    icon: <ShieldCheck className="h-6 w-6" />,
    title: 'Authenticity-first',
    desc: 'The AI never invents experiences, skills, dates, or metrics. Highlight and reorder only what\u2019s real.',
  },
  {
    eyebrow: 'BYOK',
    icon: <KeyRound className="h-6 w-6" />,
    title: 'Bring your own key',
    desc: 'Connect OpenAI, Anthropic, Gemini, or a local Ollama instance. Keys never touch our backend.',
  },
]

export default function HomePage() {
  return (
    <div className="space-y-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <p className="eyebrow rise-in">Verification-first resume builder</p>
          <h1
            className="rise-in text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl"
            style={{ animationDelay: '0.06s' }}
          >
            Build the resume that gets you{' '}
            <span className="relative whitespace-nowrap">
              past the scanner
              <span
                className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full"
                style={{ background: 'repeating-linear-gradient(90deg, var(--color-blue-600) 0 8px, transparent 8px 13px)' }}
              />
            </span>
            .
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-500" style={{ animationDelay: '0.12s' }}>
            The AI drafts, you decide. Every suggestion lands in a review queue where you approve, reject, or edit it —
            so the resume you send is yours, tuned for the machine and ready for a human.
          </p>
          <div className="flex flex-wrap gap-3 rise-in" style={{ animationDelay: '0.18s' }}>
            <Link to="/builder" className="btn-pencil">
              <FileText className="h-4 w-4" /> Start building
            </Link>
            <Link to="/import" className="btn-ghost">
              <Upload className="h-4 w-4" /> Import a resume
            </Link>
            <Link to="/jobs" className="btn-ghost">
              <Briefcase className="h-4 w-4" /> Analyze a job
            </Link>
          </div>
          <p className="text-xs leading-relaxed text-slate-400 rise-in" style={{ animationDelay: '0.24s' }}>
            Free forever tier · bring your own LLM key. Keys and data stay in your browser.
          </p>
        </div>

        <ReviewSheet />
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold tracking-tight text-slate-900">
          The AI adapts to your story
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Pick the stage you're at — every prompt and suggestion is tuned for it, never less authentic.
        </p>
        <PersonaPicker />
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} eyebrow={f.eyebrow} icon={f.icon} title={f.title} desc={f.desc} />
        ))}
      </section>
    </div>
  )
}

function ReviewSheet() {
  return (
    <div className="sheet rise-in relative mx-auto w-full max-w-sm p-6" style={{ animationDelay: '0.15s' }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="eyebrow">SCAN · ATS READOUT</span>
        <span className="chip bg-slate-100 text-slate-600">Live</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-5xl font-semibold tracking-tight text-slate-900">82</span>
        <span className="font-mono text-sm text-slate-400">/ 100</span>
      </div>
      <div className="scan-ruler mt-3">
        <span className="scan-ruler-fill" style={{ width: '82%' }} />
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
        <li className="flex items-center justify-between">
          <span>Keyword match</span>
          <span className="font-mono text-xs text-emerald-600">strong ✓</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Sectioning</span>
          <span className="font-mono text-xs text-emerald-600">ok ✓</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Contact present</span>
          <span className="font-mono text-xs text-emerald-600">ok ✓</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Quantified impact</span>
          <span className="font-mono text-xs text-amber-600">2 notes</span>
        </li>
      </ul>
      <Link
        to="/verify"
        className="mt-5 flex items-center justify-between rounded-lg bg-highlight-soft px-3 py-2.5 text-sm font-medium text-slate-900 ring-1 ring-highlight/60 transition hover:bg-highlight/40"
      >
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-highlight ring-1 ring-slate-900/20" />
          2 suggestions await your sign-off
        </span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function FeatureCard({
  eyebrow,
  icon,
  title,
  desc,
}: {
  eyebrow: string
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="sheet group p-6 transition hover:border-blue-300 hover:shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex rounded-md bg-blue-50 p-2 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
          {icon}
        </span>
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <h3 className="mb-1 text-base font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
    </div>
  )
}