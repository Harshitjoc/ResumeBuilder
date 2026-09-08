import { Link } from 'react-router-dom'
import { FileText, Briefcase, ListChecks, ShieldCheck, KeyRound } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 px-8 py-16 text-white">
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Build a resume that gets you interviewed.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-200">
          Create a resume from scratch, tailor it to any job posting, and review every
          AI change before it reaches an employer. Bring your own LLM key — your data
          stays yours.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/builder"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow hover:bg-slate-100"
          >
            <FileText className="h-4 w-4" /> Start building
          </Link>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            <Briefcase className="h-4 w-4" /> Analyze a job
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={<ListChecks className="h-6 w-6" />}
          title="Verification Queue"
          desc="Every AI change is shown side by side with the original. Approve, reject, or edit — nothing is automatic."
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
