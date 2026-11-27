import { describe, it, expect, vi, beforeEach } from 'vitest'

// Seat count feeds overage billing, so being wrong here overcharges real
// coaches. It used to be an accumulating counter: every accepted signup did
// seatCount + 1, nothing decremented when a client was archived or removed
// (only full account deletion did), and a retried signup incremented again
// per attempt. One coach was recorded as 92 seats against 9 active clients.
//
// It is now derived from the roster, and a meter event only fires when the
// roster actually grew past the plan's included allowance.

type Rel = { coach_id: string; client_id: string; status: string }

let rels: Rel[] = []
let profile: Record<string, unknown> = {}
let profileUpdates: Record<string, unknown>[] = []
let meterEvents: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: profile }) }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => { profileUpdates.push(patch); Object.assign(profile, patch); return { error: null } },
          }),
        }
      }
      if (table === 'coach_clients') {
        const filters: Record<string, unknown> = {}
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq(col: string, val: unknown) { filters[col] = val; return chain },
          then: (res: (v: { count: number }) => unknown) =>
            Promise.resolve({
              count: rels.filter((r) => Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)).length,
            }).then(res),
        }
        return chain
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    billing: { meterEvents: { create: async (e: Record<string, unknown>) => { meterEvents.push(e) } } },
  }),
}))

const { reportSeatUsage, recountCoachSeats } = await import('@/lib/billing')

function roster(activeClients: number) {
  rels = Array.from({ length: activeClients }, (_, i) => ({ coach_id: 'coach-1', client_id: `c${i}`, status: 'active' }))
}

beforeEach(() => {
  profileUpdates = []
  meterEvents = []
  rels = []
  profile = { subscription_tier: 'coach_pro', subscription_seat_count: 0, stripe_customer_id: 'cus_1' }
})

describe('seat count is derived from the roster', () => {
  it('matches the number of active clients', async () => {
    roster(9)
    const seats = await recountCoachSeats('coach-1')
    expect(seats).toBe(9)
    expect(profile.subscription_seat_count).toBe(9)
  })

  it('ignores archived, removed and inactive clients', async () => {
    rels = [
      { coach_id: 'coach-1', client_id: 'a', status: 'active' },
      { coach_id: 'coach-1', client_id: 'b', status: 'archived' },
      { coach_id: 'coach-1', client_id: 'c', status: 'removed' },
      { coach_id: 'coach-1', client_id: 'd', status: 'inactive' },
      { coach_id: 'coach-1', client_id: 'e', status: 'pending_invite' },
    ]
    expect(await recountCoachSeats('coach-1')).toBe(1)
  })

  it('does not count another coach\'s clients', async () => {
    rels = [
      { coach_id: 'coach-1', client_id: 'a', status: 'active' },
      { coach_id: 'coach-2', client_id: 'b', status: 'active' },
    ]
    expect(await recountCoachSeats('coach-1')).toBe(1)
  })

  it('corrects a count that had already drifted', async () => {
    // The exact situation found in production: 92 recorded, 9 real.
    profile.subscription_seat_count = 92
    roster(9)
    await reportSeatUsage('coach-1')
    expect(profile.subscription_seat_count).toBe(9)
  })
})

describe('overage is only billed when the roster really grew', () => {
  it('bills nothing while within the included allowance', async () => {
    roster(3) // coach_pro includes more than this
    await reportSeatUsage('coach-1')
    expect(meterEvents).toHaveLength(0)
  })

  it('a retried signup does not bill twice', async () => {
    roster(60)
    await reportSeatUsage('coach-1')
    const afterFirst = meterEvents.length
    // Same roster, called again — a retry, or a second webhook for one signup.
    await reportSeatUsage('coach-1')
    expect(meterEvents).toHaveLength(afterFirst)
  })

  it('bills nothing when the roster shrank', async () => {
    profile.subscription_seat_count = 80
    roster(60)
    await reportSeatUsage('coach-1')
    expect(meterEvents).toHaveLength(0)
    expect(profile.subscription_seat_count).toBe(60)
  })

  it('never bills a coach with no Stripe customer', async () => {
    profile.stripe_customer_id = null
    roster(80)
    await reportSeatUsage('coach-1')
    expect(meterEvents).toHaveLength(0)
    // The count is still corrected, so it's right if they subscribe later.
    expect(profile.subscription_seat_count).toBe(80)
  })
})
