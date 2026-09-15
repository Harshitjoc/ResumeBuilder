import type { ResumeData } from '@/types/resume'
import { formatDates } from './format'

const sectionTitle = 'text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400'

export default function MinimalTemplate({ resume }: { resume: ResumeData }) {
  const { contact } = resume
  const links = [
    contact.email && contact.email,
    contact.phone && contact.phone,
    contact.linkedin && contact.linkedin,
    contact.github && contact.github,
    contact.website && contact.website,
  ].filter(Boolean)

  return (
    <div className="bg-white px-14 py-12 text-slate-900">
      <header className="border-b border-slate-200 pb-8 text-center">
        <h1 className="text-3xl font-light tracking-[0.06em] text-slate-900">{contact.fullName}</h1>
        {resume.professionalSummary && (
          <p className="mx-auto mt-3 max-w-2xl text-sm font-light leading-relaxed text-slate-500">
            {resume.professionalSummary}
          </p>
        )}
        {links.length > 0 && (
          <p className="mt-4 text-xs font-normal tracking-wide text-slate-400">
            {links.join('  ·  ')}
          </p>
        )}
      </header>

      {resume.skills.length > 0 && (
        <section className="mt-9">
          <h2 className={sectionTitle}>Skills</h2>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-slate-700">
            {resume.skills.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        </section>
      )}

      {resume.experience.length > 0 && (
        <section className="mt-9">
          <h2 className={sectionTitle}>Experience</h2>
          <div className="mt-4 space-y-8">
            {resume.experience.map((exp) => (
              <div key={exp.id}>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-[15px] font-medium text-slate-900">{exp.jobTitle}</h3>
                  <span className="whitespace-nowrap text-xs text-slate-400">
                    {formatDates(exp.startDate, exp.endDate)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{exp.company}</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-600">
                  {exp.bullets.filter(Boolean).map((b, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.education.length > 0 && (
        <section className="mt-9">
          <h2 className={sectionTitle}>Education</h2>
          <div className="mt-4 space-y-4">
            {resume.education.map((edu) => (
              <div key={edu.id}>
                <h3 className="text-sm font-medium text-slate-900">{edu.degree}</h3>
                <p className="text-sm text-slate-500">{edu.school}</p>
                <p className="text-xs text-slate-400">
                  {edu.endDate}
                  {edu.gpa && ` · GPA: ${edu.gpa}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.projects.length > 0 && (
        <section className="mt-9">
          <h2 className={sectionTitle}>Projects</h2>
          <div className="mt-4 space-y-5">
            {resume.projects.map((proj) => (
              <div key={proj.id}>
                <h3 className="text-sm font-medium text-slate-900">
                  {proj.name}
                  {proj.link && (
                    <span className="ml-2 text-xs font-normal text-slate-400">{proj.link}</span>
                  )}
                </h3>
                {proj.technologies.length > 0 && (
                  <p className="text-xs font-light text-slate-400">{proj.technologies.join(', ')}</p>
                )}
                <p className="mt-0.5 text-sm font-light leading-relaxed text-slate-600">
                  {proj.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section className="mt-9">
          <h2 className={sectionTitle}>Certifications</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {resume.certifications.map((cert) => (
              <li key={cert.id} className="flex gap-2.5">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                {cert.name} — {cert.issuer}
                {cert.date && <span className="text-slate-400"> ({cert.date})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {resume.notes && resume.notes.trim() && (
        <section className="mt-9">
          <h2 className={sectionTitle}>Notes</h2>
          <p className="mt-3 whitespace-pre-line text-sm font-light leading-relaxed text-slate-600">
            {resume.notes}
          </p>
        </section>
      )}
    </div>
  )
}