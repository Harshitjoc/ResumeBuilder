import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import {
  supabase,
  isSupabaseConfigured,
  onAuthStateChange,
  upsertProfile,
  getProfile,
  type ProfileRecord,
} from '@/services/supabase'
import { setUserId } from '@/services/clientKey'
import { refreshPlan } from '@/services/plan'
import { startCloudSync, resetCloudSyncState } from '@/services/cloudSync'
import type { SessionUser } from '@/store/appStore'

function applyProfilePrefills(profile: ProfileRecord) {
  const s = useAppStore.getState()
  const resume = { ...s.resume }
  let changed = false

  if (profile.fullName && !resume.contact.fullName.trim()) {
    resume.contact = { ...resume.contact, fullName: profile.fullName }
    changed = true
  }
  if (s.sessionUser?.email && !resume.contact.email.trim()) {
    resume.contact = { ...resume.contact, email: s.sessionUser.email }
    changed = true
  }
  if (profile.phone && !resume.contact.phone.trim()) {
    resume.contact = { ...resume.contact, phone: profile.phone }
    changed = true
  }
  if (profile.headline && !resume.professionalSummary.trim()) {
    resume.professionalSummary = profile.headline
    changed = true
  }

  if (changed) s.setResume(resume)
}

function buildSessionUser(u: {
  id: string
  email?: string | null
  is_anonymous?: boolean
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}, profile: ProfileRecord | null): SessionUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const full_name = (meta.full_name as string) ?? profile?.fullName ?? null
  return {
    id: u.id,
    email: u.email ?? null,
    full_name: full_name?.trim() || null,
    is_anonymous: u.is_anonymous ?? u.app_metadata?.provider === 'anonymous',
    avatarUrl: (meta.avatar_url as string) ?? profile?.avatarUrl ?? null,
    phone: (meta.phone as string) ?? profile?.phone ?? null,
    location: (meta.location as string) ?? profile?.location ?? null,
    headline: (meta.headline as string) ?? profile?.headline ?? null,
  }
}

export function useAuthEffects() {
  const setSession = useAppStore((s) => s.setSession)
  const clearSession = useAppStore((s) => s.clearSession)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user) {
          const u = session.user
          const store = useAppStore.getState()
          const user = buildSessionUser(u, null)
          const status = user.is_anonymous ? 'anonymous' : 'signed-in'
          setSession(user, status)
          setUserId(u.id)

          // Local-first privacy: the persisted store belongs to the previous
          // owner. A DIFFERENT identity opening this browser starts fresh so
          // nobody inherits someone else's resume. Reloads (same anonymous
          // user) and returning users keep their work.
          const prevOwner = store.ownerUserId
          store.setOwnerUserId(u.id)
          if (prevOwner && prevOwner !== u.id) {
            store.resetWorkspace()
          }

          // Merge persisted profile info (name/avatar/contact) from the DB so
          // older accounts that predate the profile fields still surface them.
          const metadataName = ((u.user_metadata?.full_name as string) ?? '')?.trim()
          const profile = await getProfile(u.id)
          if (profile) {
            const merged = buildSessionUser(u, profile)
            if (JSON.stringify(merged) !== JSON.stringify(user)) setSession(merged, status)
            applyProfilePrefills(profile)
          }

          upsertProfile(u.id, {
            fullName: metadataName || profile?.fullName || undefined,
            avatarUrl: (u.user_metadata?.avatar_url as string) ?? profile?.avatarUrl ?? undefined,
            phone: (u.user_metadata?.phone as string) ?? profile?.phone ?? undefined,
            location: (u.user_metadata?.location as string) ?? profile?.location ?? undefined,
            headline: (u.user_metadata?.headline as string) ?? profile?.headline ?? undefined,
          }).catch(() => {})
          refreshPlan()
          void startCloudSync()
        } else if (event === 'INITIAL_SESSION') {
          clearSession()
        }
      } else if (event === 'SIGNED_OUT') {
        // Signing out returns this browser to a pristine visitor state: no
        // leftover resume, keys, or custom templates. Everything signed-in was
        // synced to the cloud, so the user's data is restored on next sign-in.
        useAppStore.getState().resetWorkspace()
        useAppStore.getState().setOwnerUserId(null)
        useAppStore.getState().clearApiKeys()
        clearSession()
        setUserId(null)
        resetCloudSyncState()
      }
    })

    return () => subscription.unsubscribe()
  }, [setSession, clearSession])
}