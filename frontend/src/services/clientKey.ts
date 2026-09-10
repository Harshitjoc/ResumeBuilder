const CLIENT_KEY_STORAGE = 'rb-client-key'
const USER_ID_STORAGE = 'rb-user-id'

export function getClientKey(): string {
  let key = localStorage.getItem(CLIENT_KEY_STORAGE)
  if (!key) {
    const rand =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
    key = rand + Date.now().toString(36)
    localStorage.setItem(CLIENT_KEY_STORAGE, key)
  }
  return key
}

export function getUserId(): string | null {
  return localStorage.getItem(USER_ID_STORAGE)
}

export function setUserId(userId: string | null): void {
  if (userId) localStorage.setItem(USER_ID_STORAGE, userId)
  else localStorage.removeItem(USER_ID_STORAGE)
}