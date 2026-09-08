import type { ResumeData } from '@/types/resume'

const sectionTitle = 'text-sm font-bold uppercase tracking-widest text-indigo-700'

function pretty(date: string) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return date
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export default function ModernTemplate({ resume }: { resume: ResumeData }) {
  const { contact } = resume

  return (
    <div className="grid grid-cols-[220px_1fr] gap-6 bg-white text-slate-900">
      <aside className="bg-indigo-700 py-8 pl-5 pr-4 text-white">
        <h1 className="text-2xl font-extrabold leading-tight">{contact.fullName}</h1>
        {contact.email && (
          <p className="mt-4 break-all text-xs text-indigo-100">{contact.email}</p>
        )}
        {contact.phone && (
          <p className="mt-1 text-xs text-indigo-100">{contact.phone}</p>
        )}
        {(contact.linkedin || contact.github || contact.website) && (
          <div className="mt-4 space-y-1 text-xs text-indigo-100">
            {contact.linkedin && <p className="break-all">{contact.linkedin}</p>}
            {contact.github && <p className="break-all">{contact.github}</p>}
            {contact.website && <p className="break-all">{contact.website}</p>}
          </div>
        )}

        {resume.skills.length > 0 && (
          <div className="mt-8">
            <h2 className={sectionTitle}>Skills</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {resume.skills.map((s, i) => (
                <span
                  key={i}
                  className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="py-8 pr-6">
        {resume.professionalSummary && (
          <section className="mb-8">
            <h2 className={sectionTitle}>About</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {resume.professionalSummary}
            </p>
          </section>
        )}

        {resume.experience.length > 0 && (
          <section className="mb-8">
            <h2 className={sectionTitle}>Experience</h2>
            <div className="mt-3 space-y-5">
              {resume.experience.map((exp) => (
                <div key={exp.id}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-bold">{exp.jobTitle}</h3>
                    <span className="text-xs text-slate-500">
                      {exp.startDate && pretty(exp.startDate)} –{' '}
                      {exp.endDate ? pretty(exp.endDate) : 'Present'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-indigo-700">{exp.company}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed text-slate-700">
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
          <section className="mb-8">
            <h2 className={sectionTitle}>Education</h2>
            <div className="mt-3 space-y-3">
              {resume.education.map((edu) => (
                <div key={edu.id}>
                  <h3 className="text-sm font-bold">{edu.degree}</h3>
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
          <section className="mb-8">
            <h2 className={sectionTitle}>Projects</h2>
            <div className="mt-3 space-y-4">
              {resume.projects.map((proj) => (
                <div key={proj.id}>
                  <h3 className="text-sm font-bold">
                    {proj.name}
                    {proj.link && (
                      <span className="ml-2 text-xs font-normal underline text-indigo-700">
                        {proj.link}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs italic text-slate-500">
                    {proj.technologies.join(', ')}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">{proj.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {resume.certifications.length > 0 && (
          <section>
            <h2 className={sectionTitle}>Certifications</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
              {resume.certifications.map((cert) => (
                <li key={cert.id}>
                  {cert.name} — {cert.issuer}
                  {cert.date && (
                    <span className="text-slate-500"> ({pretty(cert.date)})</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
