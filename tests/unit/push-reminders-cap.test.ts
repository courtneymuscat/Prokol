import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Minimal fake postgrest-style query builder — same pattern used by the
// other admin/org unit tests in this suite: narrows an in-memory row set as
// filter methods chain, awaitable both via a terminal method and bare.
function makeBuilder(data: Record<string, unknown>[]) {
  let rows = [...data]
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val)
      return builder
    },
    in: (col: string, vals: unknown[]) => {
      rows = rows.filter((r) => vals.includes(r[col]))
      return builder
    },
    is: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val)
      return builder
    },
    gte: () => builder,
    lte: () => builder,
    neq: () => builder,
    or: () => builder,
    order: () => builder,
    limit: (n: number) => {
      rows = rows.slice(0, n)
      return builder
    },
    range: (from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null }),
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (v: { data: unknown; count: number; error: null }) => void) =>
      resolve({ data: rows, count: rows.length, error: null }),
  }
  return builder
}

let fixtures: Record<string, Record<string, unknown>[]> = {}
let sentPushes: { userId: string; tag?: string }[] = []

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => makeBuilder(fixtures[table] ?? []),
  }),
}))

vi.mock('@/lib/push', () => ({
  sendPushToUser: vi.fn(async (userId: string, payload: { tag?: string }) => {
    sentPushes.push({ userId, tag: payload.tag })
  }),
}))

process.env.CRON_SECRET = 'test-secret'

const { GET } = await import('@/app/api/cron/push-reminders/route')

function fakeRequest(): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer test-secret' : null) },
  } as unknown as NextRequest
}

const today = new Date()
const dateStr = today.toISOString().split('T')[0]
const dayOfWeek = today.getUTCDay()
const tenDaysAgo = new Date(today.getTime() - 10 * 86400000).toISOString().split('T')[0]

beforeEach(() => {
  sentPushes = []

  fixtures = {
    // A client who, on the same day, qualifies for THREE candidate nudges:
    // cycle (last logged 10 days ago), a scheduled check-in due today, and
    // a workout due today. Only the top 2 by priority should actually send.
    profiles: [
      { id: 'client-1', sex: 'female', timezone: null, first_name: 'Test', full_name: 'Test Client' },
      { id: 'coach-1', sex: 'male', timezone: null, first_name: 'Coach', full_name: 'Test Coach' },
    ],
    cycle_logs: [{ user_id: 'client-1', log_date: tenDaysAgo, period: false }],
    checkin_schedules: [
      {
        client_id: 'client-1',
        title: 'Weekly Check-in',
        day_of_week: dayOfWeek,
        repeat_type: 'weekly',
        start_date: '2026-01-01',
        is_active: true,
        profiles: { timezone: null },
      },
    ],
    client_programs: [
      {
        id: 'prog-1',
        client_id: 'client-1',
        coach_id: 'coach-1',
        status: 'active',
        start_date: dateStr,
        // 10 weeks of content so the "program running out" coach reminder
        // (daysLeft would be ~69) doesn't also fire off the same fixture row.
        content: Array.from({ length: 10 }, () => ({
          days: [{ name: 'Day 1', items: [{ type: 'exercise' }] }],
        })),
        profiles: { timezone: null },
      },
    ],
    // Everything below is empty so the other sections (autoflow tasks,
    // birthdays, 7-day inactivity nudge, booking reminders, autoflow
    // running out) are all no-ops for this test.
    client_autoflows: [],
    calendar_events: [],
    coach_clients: [],
    bookings: [],
  }
})

describe('push-reminders cron: per-client daily cap', () => {
  it('sends only the top 2 candidates (cycle, then check-in-due) and drops the 3rd (workout)', async () => {
    const res = await GET(fakeRequest())
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.pushed).toBe(2)

    const clientPushes = sentPushes.filter((p) => p.userId === 'client-1')
    expect(clientPushes).toHaveLength(2)
    expect(clientPushes.map((p) => p.tag).sort()).toEqual(['cycle-reminder', 'scheduled-checkin'])
    expect(clientPushes.some((p) => p.tag === 'workout-reminder')).toBe(false)
  })

  it('does not send the cycle reminder when the client logged within the last 7 days', async () => {
    fixtures.cycle_logs = [{ user_id: 'client-1', log_date: dateStr, period: false }]
    // Also remove the check-in schedule so cycle's absence is unambiguous.
    fixtures.checkin_schedules = []

    const res = await GET(fakeRequest())
    const json = await res.json()

    // Workout is still the only remaining candidate and becomes the fallback slot.
    expect(json.pushed).toBe(1)
    const clientPushes = sentPushes.filter((p) => p.userId === 'client-1')
    expect(clientPushes.map((p) => p.tag)).toEqual(['workout-reminder'])
  })
})
