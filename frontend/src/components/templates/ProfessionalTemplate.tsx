import type { ResumeData } from '@/types/resume'
import { formatDates } from './format'

const sideLabel = 'text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400'
const mainTitle = 'text-[13px] font-bold uppercase tracking-wide text-slate-900'

export default function ProfessionalTemplate({ resume }: { resume: ResumeData }) {
  const { contact } = resume

  return (
    <div className="grid grid-cols-[200px_1fr] bg-white text-slate-900">
      <aside className="bg-slate-50 py-10 pl-8 pr-5">
        <h1 className="text-[22px] font-bold leading-tight text-slate-900">
          {contact.fullName.split(' ').map((w, i) => (
            <span key={i} className="block">{w}</span>
          ))}
        </h1>

        <div className="mt-6 space-y-1.5 text-xs leading-relaxed text-slate-600">
          {contact.email && <p className="break-all">{contact.email}</p>}
          {contact.phone && <p>{contact.phone}</p>}
          {contact.linkedin && <p className="break-all">{contact.linkedin}</p>}
          {contact.github && <p className="break-all">{contact.github}</p>}
          {contact.website && <p className="break-all">{contact.website}</p>}
        </div>

        {resume.skills.length > 0 && (
          <section className="mt-8">
            <h2 className={sideLabel}>Skills</h2>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-snug text-slate-700">
              {resume.skills.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        {resume.certifications.length > 0 && (
          <section className="mt-8">
            <h2 className={sideLabel}>Certifications</h2>
            <ul className="mt-2 space-y-2 text-[12px] leading-snug text-slate-600">
              {resume.certifications.map((cert) => (
                <li key={cert.id}>
                  <span className="font-medium text-slate-800">{cert.name}</span>
                  <br />
                  {cert.issuer}
                  {cert.date && <span className="text-slate-500"> · {cert.date}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      <div className="py-10 pl-8 pr-10">
        {resume.professionalSummary && (
          <section>
            <h2 className={mainTitle}>Professional Summary</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
              {resume.professionalSummary}
            </p>
          </section>
        )}

        {resume.experience.length > 0 && (
          <section className="mt-8">
            <h2 className={mainTitle}>Experience</h2>
            <div className="mt-3 space-y-5">
              {resume.experience.map((exp) => (
                <div key={exp.id} className="border-l-2 border-slate-200 pl-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-[14px] font-bold text-slate-900">{exp.jobTitle}</h3>
                    <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">
                      {formatDates(exp.startDate, exp.endDate)}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-600">{exp.company}</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-slate-700">
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
            <h2 className={mainTitle}>Education</h2>
            <div className="mt-3 space-y-3">
              {resume.education.map((edu) => (
                <div key={edu.id} className="flex items-baseline justify-between gap-4">
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900">{edu.degree}</h3>
                    <p className="text-[13px] text-slate-600">{edu.school}</p>
                  </div>
                  <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                    {edu.endDate}
                    {edu.gpa && <p>GPA: {edu.gpa}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {resume.projects.length > 0 && (
          <section className="mt-8">
            <h2 className={mainTitle}>Projects</h2>
            <div className="mt-3 space-y-4">
              {resume.projects.map((proj) => (
                <div key={proj.id}>
                  <h3 className="text-[14px] font-bold text-slate-900">
                    {proj.name}
                    {proj.link && (
                      <span className="ml-2 text-[11px] font-normal text-slate-400">
                        {proj.link}
                      </span>
                    )}
                  </h3>
                  {proj.technologies.length > 0 && (
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {proj.technologies.join(' · ')}
                    </p>
                  )}
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">
                    {proj.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {resume.notes && resume.notes.trim() && (
          <section className="mt-8">
            <h2 className={mainTitle}>Notes</h2>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-slate-600">
              {resume.notes}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}