import { describe, it, expect, vi } from 'vitest'

// Minimal fake postgrest-style query builder: narrows an in-memory row set as
// filter methods chain, and is awaitable both via a terminal method
// (.range/.single/.maybeSingle) and bare (via .then()) for chains that don't
// call a terminal method — mirroring how lib/admin.ts actually calls things.
function makeBuilder(data: Record<string, unknown>[]) {
  let rows = [...data]

  function applyOrCondition(row: Record<string, unknown>, col: string, op: string, value: string) {
    const rv = row[col]
    if (op === 'is') return value === 'null' ? rv === null : String(rv) === value
    if (op === 'lt') return rv != null && new Date(rv as string) < new Date(value)
    if (op === 'gt') return rv != null && new Date(rv as string) > new Date(value)
    return false
  }

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
    or: (expr: string) => {
      const conditions = expr.split(',').map((c) => {
        const parts = c.split('.')
        return { col: parts[0], op: parts[1], value: parts.slice(2).join('.') }
      })
      rows = rows.filter((r) => conditions.some(({ col, op, value }) => applyOrCondition(r, col, op, value)))
      return builder
    },
    order: () => builder,
    limit: (n: number) => {
      rows = rows.slice(0, n)
      return builder
    },
    range: (from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null }),
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (resolve: (v: { data: unknown; count: number; error: null }) => void) =>
      resolve({ data: rows, count: rows.length, error: null }),
  }
  return builder
}

let fixtures: Record<string, Record<string, unknown>[]> = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => makeBuilder(fixtures[table] ?? []),
  }),
}))

const { getAllCoaches } = await import('@/lib/admin')

const now = new Date()
const future = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
const past = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

function resetFixtures() {
  fixtures = {
    profiles: [
      { id: 'coach-a', full_name: 'Coach A', email: 'a@x.com', subscription_tier: 'coach_solo', stripe_customer_id: null, created_at: '2026-01-01', org_id: null, coach_grace_until: null, user_type: 'coach' },
      { id: 'coach-b', full_name: 'Coach B', email: 'b@x.com', subscription_tier: 'coach_solo', stripe_customer_id: null, created_at: '2026-01-01', org_id: null, coach_grace_until: future, user_type: 'coach' },
      { id: 'coach-c', full_name: 'Coach C', email: 'c@x.com', subscription_tier: 'coach_solo', stripe_customer_id: null, created_at: '2026-01-01', org_id: 'org-1', coach_grace_until: null, user_type: 'coach' },
      { id: 'coach-d', full_name: 'Coach D', email: 'd@x.com', subscription_tier: 'coach_solo', stripe_customer_id: null, created_at: '2026-01-01', org_id: null, coach_grace_until: past, user_type: 'coach' },
    ],
    organisations: [{ id: 'org-1', name: 'Test Org' }],
    coach_clients: [],
  }
}

describe('getAllCoaches independentOnly filter', () => {
  it('returns every coach when independentOnly is false (default)', async () => {
    resetFixtures()
    const { coaches, total } = await getAllCoaches(1, 50)
    expect(total).toBe(4)
    expect(coaches.map((c) => c.id).sort()).toEqual(['coach-a', 'coach-b', 'coach-c', 'coach-d'])
  })

  it('includes org_id=null with no grace period, excludes org members and active-grace coaches', async () => {
    resetFixtures()
    const { coaches, total } = await getAllCoaches(1, 50, true)
    expect(total).toBe(2)
    expect(coaches.map((c) => c.id).sort()).toEqual(['coach-a', 'coach-d'])
  })

  it('excludes a coach whose grace period has not yet expired', async () => {
    resetFixtures()
    const { coaches } = await getAllCoaches(1, 50, true)
    expect(coaches.find((c) => c.id === 'coach-b')).toBeUndefined()
  })

  it('excludes a coach who is an active org member', async () => {
    resetFixtures()
    const { coaches } = await getAllCoaches(1, 50, true)
    expect(coaches.find((c) => c.id === 'coach-c')).toBeUndefined()
  })
})
