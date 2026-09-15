import type { ComponentType } from 'react'
import type { ResumeData, TemplateId } from '@/types/resume'
import ClassicTemplate from './ClassicTemplate'
import ModernTemplate from './ModernTemplate'
import MinimalTemplate from './MinimalTemplate'
import BoldTemplate from './BoldTemplate'
import ProfessionalTemplate from './ProfessionalTemplate'

export interface TemplateMeta {
  id: TemplateId
  label: string
  description: string
}

const TEMPLATES: Record<TemplateId, ComponentType<{ resume: ResumeData }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  bold: BoldTemplate,
  professional: ProfessionalTemplate,
}

export const TEMPLATE_META: TemplateMeta[] = [
  { id: 'classic', label: 'Classic', description: 'Traditional single-column with serif headings.' },
  { id: 'modern', label: 'Modern', description: 'Indigo sidebar with a bold accent.' },
  { id: 'minimal', label: 'Minimal', description: 'Airy one-column, generous whitespace.' },
  { id: 'bold', label: 'Bold', description: 'High-contrast dark header for standing out.' },
  { id: 'professional', label: 'Professional', description: 'Clean monochrome two-column corporate.' },
]

export const TEMPLATE_IDS: TemplateId[] = ['classic', 'modern', 'minimal', 'bold', 'professional']

export function getTemplate(id: TemplateId) {
  return TEMPLATES[id] ?? ClassicTemplate
}

export function normalizeTemplate(raw: unknown): TemplateId {
  return typeof raw === 'string' && raw in TEMPLATES ? (raw as TemplateId) : 'classic'
}