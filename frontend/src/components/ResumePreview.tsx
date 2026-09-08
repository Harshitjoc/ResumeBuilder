import type { ResumeData } from '@/types/resume'
import ClassicTemplate from '@/components/templates/ClassicTemplate'
import ModernTemplate from '@/components/templates/ModernTemplate'

export default function ResumePreview({ resume }: { resume: ResumeData }) {
  return resume.template === 'modern' ? (
    <ModernTemplate resume={resume} />
  ) : (
    <ClassicTemplate resume={resume} />
  )
}
