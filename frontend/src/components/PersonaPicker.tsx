import { GraduationCap, Briefcase, Repeat } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { TargetUser } from '@/types/resume'

const PERSONAS: Array<{
  key: TargetUser
  label: string
  desc: string
  icon: typeof GraduationCap
}> = [
  {
    key: 'recent-grad',
    label: 'Recent graduate',
    desc: 'Just starting out? We highlight projects, coursework, and transferable skills.',
    icon: GraduationCap,
  },
  {
    key: 'working-professional',
    label: 'Working professional',
    desc: 'Experienced and focused? We emphasize impact, leadership, and measurable results.',
    icon: Briefcase,
  },
  {
    key: 'career-switcher',
    label: 'Career switcher',
    desc: 'Changing paths? We reframe your experience to match what employers are looking for.',
    icon: Repeat,
  },
]

export function PersonaPicker({ compact }: { compact?: boolean }) {
  const targetUser = useAppStore((s) => s.targetUser)
  const setTargetUser = useAppStore((s) => s.setTargetUser)

  if (compact) {
    return (
      <select
        value={targetUser ?? ''}
        onChange={(e) => setTargetUser((e.target.value as TargetUser) || null)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
      >
        <option value="">Persona...</option>
        {PERSONAS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {PERSONAS.map((p) => {
        const Icon = p.icon
        const active = targetUser === p.key
        return (
          <button
            key={p.key}
            onClick={() => setTargetUser(active ? null : p.key)}
            className={`rounded-2xl border-2 p-5 text-left transition ${
              active
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            <Icon className={`mb-2 h-6 w-6 ${active ? 'text-white' : 'text-slate-500'}`} />
            <p className="text-sm font-semibold">{p.label}</p>
            <p className={`mt-1 text-xs ${active ? 'text-slate-200' : 'text-slate-500'}`}>
              {p.desc}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export function PersonaBadge() {
  const targetUser = useAppStore((s) => s.targetUser)
  if (!targetUser) return null
  const meta = PERSONAS.find((p) => p.key === targetUser)
  if (!meta) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {meta.label}
    </span>
  )
}
