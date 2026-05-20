// Client-side fire-and-forget helper. Call after a successful local log to
// let the client's coach know — server resolves the calling user, checks
// the coach's pref, and sends a push if enabled. All errors are swallowed.

export type CoachNotifyEvent = 'food' | 'weight' | 'cycle' | 'workout' | 'habit' | 'photo'

export function notifyMyCoach(event: CoachNotifyEvent): void {
  if (typeof window === 'undefined') return
  void fetch('/api/client/notify-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {/* swallow — best-effort notification */})
}
