import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Check } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { ResumeData, Experience, Education, Project, Certification } from '@/types/resume'
import ResumePreview from '@/components/ResumePreview'

export default function BuilderPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <ResumeForm />
      <PreviewPanel />
    </div>
  )
}

function PreviewPanel() {
  const resume = useAppStore((s) => s.resume)
  const navigate = useNavigate()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Live Preview</h2>
        <button
          onClick={() => navigate('/preview')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Full screen
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {resume.contact.fullName ? (
          <ResumeComp />
        ) : (
          <p className="p-8 text-center text-sm text-slate-400">
            Fill in your details on the left to see a live preview.
          </p>
        )}
      </div>
    </div>
  )
}

function ResumeComp() {
  const resume = useAppStore((s) => s.resume)
  return <ResumePreview resume={resume} />
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  const cls =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {textarea ? (
        <textarea
          className={`${cls} min-h-20`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={cls}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function ResumeForm() {
  const resume = useAppStore((s) => s.resume)
  const setResume = useAppStore((s) => s.setResume)
  const updateContact = useAppStore((s) => s.updateContact)
  const updateSummary = useAppStore((s) => s.updateSummary)
  const updateSkills = useAppStore((s) => s.updateSkills)

  const update = (patch: Partial<ResumeData>) => setResume({ ...resume, ...patch })
  const updateExperience = (list: Experience[]) => update({ experience: list })
  const updateEducation = (list: Education[]) => update({ education: list })
  const updateProjects = (list: Project[]) => update({ projects: list })
  const updateCerts = (list: Certification[]) => update({ certifications: list })

  return (
    <div className="space-y-6">
      <Card title="Contact Information">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" value={resume.contact.fullName} onChange={(v) => updateContact({ fullName: v })} />
          <Field label="Email" value={resume.contact.email} onChange={(v) => updateContact({ email: v })} />
          <Field label="Phone" value={resume.contact.phone} onChange={(v) => updateContact({ phone: v })} />
          <Field label="LinkedIn" value={resume.contact.linkedin} onChange={(v) => updateContact({ linkedin: v })} />
          <Field label="GitHub" value={resume.contact.github} onChange={(v) => updateContact({ github: v })} />
          <Field label="Website" value={resume.contact.website} onChange={(v) => updateContact({ website: v })} />
        </div>
      </Card>

      <Card title="Professional Summary">
        <Field textarea label="Summary" value={resume.professionalSummary} onChange={updateSummary} placeholder="2-3 sentences about your career..." />
      </Card>

      <Card title="Skills">
        <SkillsEditor value={resume.skills} onChange={updateSkills} />
      </Card>

      <Card title="Template">
        <div className="flex gap-3">
          {(['classic', 'modern'] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ template: t })}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium capitalize transition ${
                resume.template === t
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {resume.template === t && <Check className="mr-1 inline h-4 w-4" />}
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Work Experience">
        {resume.experience.length === 0 && <EmptyState label="No experience yet" />}
        {resume.experience.map((exp) => (
          <ExperienceEditor key={exp.id} exp={exp} onChange={(updated) => updateExperience(resume.experience.map((e) => (e.id === updated.id ? updated : e)))} onRemove={() => updateExperience(resume.experience.filter((e) => e.id !== exp.id))} />
        ))}
        <AddButton label="Add experience" onClick={() => updateExperience([...resume.experience, newExperience()])} />
      </Card>

      <Card title="Education">
        {resume.education.length === 0 && <EmptyState label="No education yet" />}
        {resume.education.map((edu) => (
          <EducationEditor key={edu.id} edu={edu} onChange={(updated) => updateEducation(resume.education.map((e) => (e.id === updated.id ? updated : e)))} onRemove={() => updateEducation(resume.education.filter((e) => e.id !== edu.id))} />
        ))}
        <AddButton label="Add education" onClick={() => updateEducation([...resume.education, newEducation()])} />
      </Card>

      <Card title="Projects">
        {resume.projects.length === 0 && <EmptyState label="No projects yet" />}
        {resume.projects.map((proj) => (
          <ProjectEditor key={proj.id} proj={proj} onChange={(updated) => updateProjects(resume.projects.map((p) => (p.id === updated.id ? updated : p)))} onRemove={() => updateProjects(resume.projects.filter((p) => p.id !== proj.id))} />
        ))}
        <AddButton label="Add project" onClick={() => updateProjects([...resume.projects, newProject()])} />
      </Card>

      <Card title="Certifications">
        {resume.certifications.length === 0 && <EmptyState label="No certifications yet" />}
        {resume.certifications.map((cert) => (
          <CertEditor key={cert.id} cert={cert} onChange={(updated) => updateCerts(resume.certifications.map((c) => (c.id === updated.id ? updated : c)))} onRemove={() => updateCerts(resume.certifications.filter((c) => c.id !== cert.id))} />
        ))}
        <AddButton label="Add certification" onClick={() => updateCerts([...resume.certifications, newCert()])} />
      </Card>
    </div>
  )
}

function SkillsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  return (
    <Field
      label="Skills (comma separated)"
      value={text}
      onChange={(v) => {
        setText(v)
        onChange(v.split(',').map((s) => s.trim()).filter(Boolean))
      }}
    />
  )
}

function ExperienceEditor({ exp, onChange, onRemove }: { exp: Experience; onChange: (e: Experience) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job title" value={exp.jobTitle} onChange={(v) => onChange({ ...exp, jobTitle: v })} />
        <Field label="Company" value={exp.company} onChange={(v) => onChange({ ...exp, company: v })} />
        <Field label="Start date" value={exp.startDate} onChange={(v) => onChange({ ...exp, startDate: v })} />
        <Field label="End date" value={exp.endDate} onChange={(v) => onChange({ ...exp, endDate: v })} />
      </div>
      <div className="mt-3">
        <BulletsEditor bullets={exp.bullets} onChange={(bullets) => onChange({ ...exp, bullets })} />
      </div>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </div>
  )
}

function BulletsEditor({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Achievements / bullet points</label>
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            value={b}
            onChange={(e) => onChange(bullets.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button onClick={() => onChange(bullets.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...bullets, ''])}
        className="text-sm font-medium text-slate-600 hover:text-slate-800"
      >
        + Add bullet
      </button>
    </div>
  )
}

function EducationEditor({ edu, onChange, onRemove }: { edu: Education; onChange: (e: Education) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Degree" value={edu.degree} onChange={(v) => onChange({ ...edu, degree: v })} />
        <Field label="School" value={edu.school} onChange={(v) => onChange({ ...edu, school: v })} />
        <Field label="End date" value={edu.endDate} onChange={(v) => onChange({ ...edu, endDate: v })} />
        <Field label="GPA (optional)" value={edu.gpa || ''} onChange={(v) => onChange({ ...edu, gpa: v })} />
      </div>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </div>
  )
}

function ProjectEditor({ proj, onChange, onRemove }: { proj: Project; onChange: (p: Project) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project name" value={proj.name} onChange={(v) => onChange({ ...proj, name: v })} />
        <Field label="Link" value={proj.link} onChange={(v) => onChange({ ...proj, link: v })} />
      </div>
      <div className="mt-3">
        <Field label="Technologies (comma separated)" value={proj.technologies.join(', ')} onChange={(v) => onChange({ ...proj, technologies: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </div>
      <div className="mt-3">
        <Field textarea label="Description" value={proj.description} onChange={(v) => onChange({ ...proj, description: v })} />
      </div>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </div>
  )
}

function CertEditor({ cert, onChange, onRemove }: { cert: Certification; onChange: (c: Certification) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Name" value={cert.name} onChange={(v) => onChange({ ...cert, name: v })} />
        <Field label="Issuer" value={cert.issuer} onChange={(v) => onChange({ ...cert, issuer: v })} />
        <Field label="Date" value={cert.date} onChange={(v) => onChange({ ...cert, date: v })} />
      </div>
      <button onClick={onRemove} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
        <Trash2 className="h-3 w-3" /> Remove
      </button>
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
      <Plus className="h-4 w-4" /> {label}
    </button>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm italic text-slate-400">{label}</p>
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}
const newExperience = (): Experience => ({ id: uid(), jobTitle: '', company: '', startDate: '', endDate: '', bullets: [''] })
const newEducation = (): Education => ({ id: uid(), degree: '', school: '', endDate: '', gpa: '' })
const newProject = (): Project => ({ id: uid(), name: '', description: '', link: '', technologies: [] })
const newCert = (): Certification => ({ id: uid(), name: '', issuer: '', date: '' })
