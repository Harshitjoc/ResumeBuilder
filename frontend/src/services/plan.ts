import { useAppStore } from '@/store/appStore'
import { getMe } from '@/services/llm'

export async function refreshPlan(): Promise<void> {
  try {
    const me = await getMe()
    useAppStore.getState().setPlan({
      tier: me.plan,
      expiresAt: me.planExpiresAt,
      quotaRemaining: me.quotaRemaining,
      quotaLimit: me.quotaLimit,
    })
    useAppStore.getState().setRole(me.role ?? null)
    useAppStore.getState().setFeatures(me.features ?? {})
  } catch {
    // Backend unreachable — keep whatever plan state we already have.
  }
}