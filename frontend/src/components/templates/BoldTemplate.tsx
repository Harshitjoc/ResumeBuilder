import type { ResumeData } from '@/types/resume'
import { formatDates } from './format'

const sectionTitle = 'text-xs font-bold uppercase tracking-[0.18em] text-amber-500'

export default function BoldTemplate({ resume }: { resume: ResumeData }) {
  const { contact } = resume

  return (
    <div className="bg-white text-slate-900">
      <header className="bg-slate-950 px-10 py-10 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{contact.fullName}</h1>
            {resume.professionalSummary && (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                {resume.professionalSummary}
              </p>
            )}
          </div>
          <div className="text-right text-xs text-slate-300">
            {contact.email && <p className="mb-1">{contact.email}</p>}
            {contact.phone && <p className="mb-1">{contact.phone}</p>}
            {contact.linkedin && <p className="mb-1">{contact.linkedin}</p>}
            {contact.github && <p className="mb-1">{contact.github}</p>}
            {contact.website && <p>{contact.website}</p>}
          </div>
        </div>
      </header>

      <div className="px-10 py-8">
        {resume.skills.length > 0 && (
          <section>
            <h2 className={sectionTitle}>Skills</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {resume.skills.map((s, i) => (
                <span
                  key={i}
                  className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        {resume.experience.length > 0 && (
          <section className="mt-8">
            <h2 className={sectionTitle}>Experience</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {resume.experience.map((exp) => (
                <div key={exp.id} className="py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-base font-bold text-slate-900">{exp.jobTitle}</h3>
                    <span className="whitespace-nowrap text-xs font-semibold text-slate-500">
                      {formatDates(exp.startDate, exp.endDate)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-amber-600">{exp.company}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                    {exp.bullets.filter(Boolean).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {resume.education.length > 0 && (
          <section className="mt-8">
            <h2 className={sectionTitle}>Education</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {resume.education.map((edu) => (
                <div key={edu.id} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">{edu.degree}</h3>
                  <p className="text-sm text-slate-600">{edu.school}</p>
                  <p className="text-xs text-slate-500">
                    {edu.endDate}
                    {edu.gpa && ` · GPA: ${edu.gpa}`}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {resume.projects.length > 0 && (
          <section className="mt-8">
            <h2 className={sectionTitle}>Projects</h2>
            <div className="mt-3 space-y-4">
              {resume.projects.map((proj) => (
                <div key={proj.id} className="rounded-lg bg-slate-50 p-4">
                  <h3 className="flex items-baseline justify-between text-sm font-bold text-slate-900">
                    {proj.name}
                    {proj.link && (
                      <span className="text-xs font-normal text-amber-600">{proj.link}</span>
                    )}
                  </h3>
                  {proj.technologies.length > 0 && (
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {proj.technologies.join(' · ')}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-700">{proj.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {resume.certifications.length > 0 && (
          <section className="mt-8">
            <h2 className={sectionTitle}>Certifications</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {resume.certifications.map((cert) => (
                <li key={cert.id}>
                  {cert.name} — {cert.issuer}
                  {cert.date && <span className="text-slate-500"> ({cert.date})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {resume.notes && resume.notes.trim() && (
          <section className="mt-8">
            <h2 className={sectionTitle}>Notes</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {resume.notes}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}