import { isSupabaseConfigured } from '@/services/supabase'
import type { SessionStatus } from '@/store/appStore'

export function sessionIsVisitor(status: SessionStatus): boolean {
  if (!isSupabaseConfigured) return false
  return status === 'signed-out'
}