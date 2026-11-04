// Pure day_offset unlock-date math, shared by the two call sites in
// app/api/client/autoflows/[flowId]/[step]/route.ts (the lock check for
// the step being viewed, and the next_step_available look-ahead) — kept
// here so it's covered by a plain unit test rather than only ever
// exercised through a mocked route handler.

export function dayOffsetAvailableDate(startDate: string, dayOffset: number): string {
  const [y, m, d] = startDate.split('-').map(Number)
  const availableMs = Date.UTC(y, m - 1, d + dayOffset)
  return new Date(availableMs).toISOString().split('T')[0]
}

export function isDayOffsetUnlocked(startDate: string, dayOffset: number, today: Date): boolean {
  const [y, m, d] = startDate.split('-').map(Number)
  const availableMs = Date.UTC(y, m - 1, d + dayOffset)
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return todayMs >= availableMs
}
