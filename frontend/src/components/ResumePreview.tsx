import type { ResumeData } from '@/types/resume'
import { getTemplate } from '@/components/templates'

export default function ResumePreview({ resume }: { resume: ResumeData }) {
  const Template = getTemplate(resume.template)
  return <Template resume={resume} />
}