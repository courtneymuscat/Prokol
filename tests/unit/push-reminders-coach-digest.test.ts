import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Same fake postgrest builder used by push-reminders-cap.test.ts.
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
    not: () => builder,
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
let sentEmails: { to: string; subject: string; html: string }[] = []

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => makeBuilder(fixtures[table] ?? []),
  }),
}))

vi.mock('@/lib/push', () => ({
  sendPushToUser: vi.fn(async () => {}),
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async (args: { to: string; subject: string; html: string }) => {
    sentEmails.push(args)
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
function daysAgo(n: number) {
  return new Date(today.getTime() - n * 86400000).toISOString().split('T')[0]
}

beforeEach(() => {
  sentEmails = []

  fixtures = {
    profiles: [
      { id: 'coach-x', email: 'coach-x@example.com', first_name: 'Coach', full_name: 'Coach X', timezone: null, sex: 'male' },
      { id: 'client-a', first_name: 'Alice', full_name: 'Alice A', timezone: null, sex: 'female' },
      { id: 'client-b', first_name: 'Bob', full_name: 'Bob B', timezone: null, sex: 'male' },
    ],
    // 1 week of (empty) content, started 3 days ago -> ends in 3 days.
    client_programs: [
      {
        id: 'prog-1', client_id: 'client-a', coach_id: 'coach-x', status: 'active',
        start_date: daysAgo(3), content: [{}],
      },
    ],
    // 2 weeks of phases, started 8 days ago -> ends in 5 days.
    client_plans: [
      {
        id: 'plan-1', client_id: 'client-b', coach_id: 'coach-x',
        start_date: daysAgo(8), phases: [{ duration_weeks: 2 }], is_visible_to_client: true,
      },
    ],
    client_autoflows: [],
    checkin_schedules: [],
    calendar_events: [],
    coach_clients: [],
    bookings: [],
    cycle_logs: [],
    coach_content_reminders_sent: [],
  }
})

describe('push-reminders cron: bundled coach email digest', () => {
  it('sends one bundled email per coach covering both training and weekly-changes items', async () => {
    const res = await GET(fakeRequest())
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.digestsSent).toBe(1)

    const coachEmails = sentEmails.filter((e) => e.to === 'coach-x@example.com')
    expect(coachEmails).toHaveLength(1)

    const html = coachEmails[0].html
    expect(html).toContain('Training programs ending soon')
    expect(html).toContain('Alice')
    expect(html).toContain('Weekly changes plans ending soon')
    expect(html).toContain('Bob')
  })

  it('does not send a digest when nothing is ending within 7 days', async () => {
    fixtures.client_programs = []
    fixtures.client_plans = []

    const res = await GET(fakeRequest())
    const json = await res.json()

    expect(json.digestsSent).toBe(0)
    expect(sentEmails).toHaveLength(0)
  })
})
