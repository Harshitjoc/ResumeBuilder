import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import {
  supabase,
  isSupabaseConfigured,
  signInAnonymously,
  onAuthStateChange,
  upsertProfile,
} from '@/services/supabase'
import { setUserId } from '@/services/clientKey'
import { refreshPlan } from '@/services/plan'
import type { SessionUser } from '@/store/appStore'

export function useAuthEffects() {
  const setSession = useAppStore((s) => s.setSession)
  const clearSession = useAppStore((s) => s.clearSession)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          const u = session.user
          const user: SessionUser = {
            id: u.id,
            email: u.email ?? null,
            full_name: (u.user_metadata?.full_name as string) ?? null,
            is_anonymous: u.is_anonymous ?? u.app_metadata?.provider === 'anonymous',
          }
          const status = user.is_anonymous ? 'anonymous' : 'signed-in'
          setSession(user, status)
          setUserId(u.id)
          upsertProfile(u.id, {}).catch(() => {})
          refreshPlan()
        } else if (event === 'INITIAL_SESSION') {
          const { error } = await signInAnonymously()
          if (error) {
            useAppStore.getState().clearSession()
          }
        }
      } else if (event === 'SIGNED_OUT') {
        clearSession()
        setUserId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setSession, clearSession])
}
