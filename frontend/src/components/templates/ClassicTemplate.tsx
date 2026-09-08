import type { ResumeData } from '@/types/resume'

const sectionTitle = 'text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3'

export default function ClassicTemplate({ resume }: { resume: ResumeData }) {
  const { contact } = resume
  const links = [
    contact.email && `Email: ${contact.email}`,
    contact.phone && `Phone: ${contact.phone}`,
    contact.linkedin && `LinkedIn: ${contact.linkedin}`,
    contact.github && `GitHub: ${contact.github}`,
    contact.website && `Website: ${contact.website}`,
  ].filter(Boolean)

  return (
    <div className="bg-white text-slate-900">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{contact.fullName}</h1>
        {resume.professionalSummary && (
          <p className="mt-2 text-sm text-slate-700">{resume.professionalSummary}</p>
        )}
        {links.length > 0 && (
          <p className="mt-3 text-xs text-slate-600">
            {links.join('  |  ')}
          </p>
        )}
      </header>

      {resume.skills.length > 0 && (
        <section className="mt-6">
          <h2 className={sectionTitle}>Technical Skills</h2>
          <p className="text-sm leading-relaxed">{resume.skills.join(', ')}</p>
        </section>
      )}

      {resume.experience.length > 0 && (
        <section className="mt-6">
          <h2 className={sectionTitle}>Work Experience</h2>
          <div className="space-y-4">
            {resume.experience.map((exp) => (
              <div key={exp.id}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold">{exp.jobTitle}</h3>
                  <span className="text-xs text-slate-500">
                    {formatDates(exp.startDate, exp.endDate)}
                  </span>
                </div>
                <p className="text-sm italic text-slate-600">{exp.company}</p>
                <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed">
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
        <section className="mt-6">
          <h2 className={sectionTitle}>Education</h2>
          <div className="space-y-2">
            {resume.education.map((edu) => (
              <div key={edu.id} className="flex items-baseline justify-between">
                <div>
                  <h3 className="text-sm font-bold">{edu.degree}</h3>
                  <p className="text-sm text-slate-600">{edu.school}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {edu.endDate}
                  {edu.gpa && <p>GPA: {edu.gpa}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.projects.length > 0 && (
        <section className="mt-6">
          <h2 className={sectionTitle}>Projects</h2>
          <div className="space-y-3">
            {resume.projects.map((proj) => (
              <div key={proj.id}>
                <h3 className="text-sm font-bold">
                  {proj.name}
                  {proj.link && (
                    <span className="ml-2 text-xs font-normal text-blue-700">{proj.link}</span>
                  )}
                </h3>
                {proj.technologies.length > 0 && (
                  <p className="text-xs italic text-slate-600">
                    {proj.technologies.join(', ')}
                  </p>
                )}
                <p className="text-sm text-slate-700">{proj.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section className="mt-6">
          <h2 className={sectionTitle}>Certifications</h2>
          <ul className="list-disc pl-5 text-sm">
            {resume.certifications.map((cert) => (
              <li key={cert.id}>
                {cert.name} — {cert.issuer}
                {cert.date && <span className="text-slate-500"> ({cert.date})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function formatDates(start: string, end: string) {
  const s = pretty(start)
  const e = end ? pretty(end) : 'Present'
  if (!start) return e
  return `${s} – ${e}`
}

function pretty(date: string) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return date
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}
