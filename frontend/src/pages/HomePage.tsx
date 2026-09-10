import { Link } from 'react-router-dom'
import { FileText, Briefcase, ListChecks, ShieldCheck, KeyRound, Upload, Sparkles, ClipboardCheck, Target, LayoutGrid } from 'lucide-react'
import { PersonaPicker } from '@/components/PersonaPicker'

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 px-8 py-16 text-white">
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Build a resume that gets you interviewed.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-200">
          Create a resume from scratch, tailor it to any job posting, and review every
          AI change before it reaches an employer. Verification-first by design.
          Works for graduates, professionals, and career-switchers.
          Bring your own LLM key — your data stays yours.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/builder"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow hover:bg-slate-100"
          >
            <FileText className="h-4 w-4" /> Start building
          </Link>
          <Link
            to="/import"
            className="inline-flex items-center gap-2 rounded-lg bg-white/90 px-5 py-3 text-sm font-semibold text-slate-900 shadow hover:bg-slate-100"
          >
            <Upload className="h-4 w-4" /> Import a resume
          </Link>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            <Briefcase className="h-4 w-4" /> Analyze a job
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">How can we help? Choose what describes you — the AI adapts.</h2>
        <PersonaPicker />
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={<Upload className="h-6 w-6" />}
          title="Import any resume"
          desc="Upload a PDF, Word, or TXT resume (or paste text) and the AI parses it into editable, structured data you verify yourself."
        />
        <FeatureCard
          icon={<ListChecks className="h-6 w-6" />}
          title="Verification Queue"
          desc="Every AI change is shown side by side with the original. Approve, reject, or edit — nothing is automatic."
        />
        <FeatureCard
          icon={<Sparkles className="h-6 w-6" />}
          title="Resume analysis"
          desc="Get a 0–100 score with ATS, impact, and structure notes — plus a job-fit score when you paste a job posting."
        />
        <FeatureCard
          icon={<ClipboardCheck className="h-6 w-6" />}
          title="ATS checker"
          desc="See how your resume scores against applicant tracking systems with keyword, structure, and formatting breakdowns."
        />
        <FeatureCard
          icon={<FileText className="h-6 w-6" />}
          title="Cover letters"
          desc="Generate tailored cover letters for any job posting, matching your resume to the role."
        />
        <FeatureCard
          icon={<Target className="h-6 w-6" />}
          title="Interview prep"
          desc="Get likely interview questions, company research points, talking points, and questions to ask — all tailored to you."
        />
        <FeatureCard
          icon={<LayoutGrid className="h-6 w-6" />}
          title="Application tracking"
          desc="Track every application from saved to offer with a visual Kanban board. Never lose track of where you are."
        />
        <FeatureCard
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Authenticity-first"
          desc="The AI never invents experiences, skills, dates, or metrics. Highlight and reorder only what's real."
        />
        <FeatureCard
          icon={<KeyRound className="h-6 w-6" />}
          title="Bring your own key"
          desc="Connect OpenAI, Anthropic, Gemini, or a local Ollama instance. Keys never touch our backend."
        />
      </section>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2 text-slate-700">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{desc}</p>
    </div>
  )
}
