// Client-side fire-and-forget helper. Call after a successful local log to
// let the client's coach know — server resolves the calling user, checks
// the coach's pref, and sends a push if enabled. All errors are swallowed.
//
// Some events fire many times in a short burst (e.g. adding several foods
// to a meal). For those, we coalesce per-device with a sliding window so
// the coach gets one push per session rather than one per item.

export type CoachNotifyEvent = 'food' | 'weight' | 'cycle' | 'workout' | 'habit' | 'photo'

const DEBOUNCE_MS: Partial<Record<CoachNotifyEvent, number>> = {
  food: 10 * 60 * 1000,
}

function shouldThrottle(event: CoachNotifyEvent): boolean {
  const window = DEBOUNCE_MS[event]
  if (!window) return false
  try {
    const key = `notify-debounce-${event}`
    const last = Number(localStorage.getItem(key))
    const now = Date.now()
    if (last && now - last < window) return true
    localStorage.setItem(key, String(now))
    return false
  } catch {
    return false
  }
}

export function notifyMyCoach(event: CoachNotifyEvent): void {
  if (typeof window === 'undefined') return
  if (shouldThrottle(event)) return
  void fetch('/api/client/notify-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {/* swallow — best-effort notification */})
}
