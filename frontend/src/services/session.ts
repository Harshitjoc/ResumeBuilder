import { isSupabaseConfigured } from '@/services/supabase'
import type { SessionStatus, SessionUser } from '@/store/appStore'

export function sessionIsAnonymous(
  status: SessionStatus,
  user: SessionUser | null,
): boolean {
  if (!isSupabaseConfigured) return false
  return status === 'anonymous' || user?.is_anonymous === true
}