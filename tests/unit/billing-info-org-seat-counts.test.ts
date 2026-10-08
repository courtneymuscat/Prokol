import { describe, it, expect, vi, beforeEach } from 'vitest'

// GET /api/billing/info used to always count only the logged-in user's own
// coach_clients, and hardcoded coach_seat_count to 0 — meaning an org with
// more than one coach always showed an undercounted client total and a
// permanently-zero coach count, regardless of real usage. For an org tier
// (coach_business/wl_starter/wl_pro) the included-seat allowance is for
// the whole organisation, so usage must be aggregated across every coach
// in the org.

let profileData: Record<string, unknown> | null = null
let membershipData: { org_id: string; org_name: string; org_slug: string; role: string } | null = null
let orgMembersData: { user_id: string }[] = []
let coachClientsCount = 0

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}))

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({}),
  buildPriceToTierMap: () => ({}),
  OVERAGE_PRICE_IDS: new Set(),
  TIER_TO_USER_TYPE: {},
}))

vi.mock('@/lib/billing', () => ({
  INCLUDED_SEATS: { coach_business: 75, wl_starter: 200 },
  INCLUDED_COACHES: { coach_business: 3, wl_starter: 5 },
  CLIENT_OVERAGE_PRICE: { coach_business: 3, wl_starter: 1.5 },
  COACH_OVERAGE_PRICE: { coach_business: 19, wl_starter: 15 },
}))

vi.mock('@/lib/org', () => ({
  getOrgForUser: async () => membershipData,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: profileData, error: null }) }) }) }
      }
      if (table === 'org_members') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              eq: async () => ({ data: val === membershipData?.org_id ? orgMembersData : [] }),
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        }
      }
      if (table === 'coach_clients') {
        return {
          select: () => ({
            eq: () => ({ eq: async () => ({ count: coachClientsCount }) }),
            in: () => ({ eq: async () => ({ count: coachClientsCount }) }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { GET } = await import('@/app/api/billing/info/route')

beforeEach(() => {
  membershipData = null
  orgMembersData = []
  coachClientsCount = 0
})

describe('GET /api/billing/info — org-wide seat counts', () => {
  it('counts only the logged-in coach\'s own clients when solo (no org)', async () => {
    profileData = { subscription_tier: 'coach_pro', stripe_customer_id: null, stripe_subscription_id: null }
    coachClientsCount = 8
    const res = await GET()
    const json = await res.json()
    expect(json.seat_count).toBe(8)
    expect(json.coach_seat_count).toBe(0)
  })

  it('aggregates client count across every coach in the org, not just the viewer', async () => {
    profileData = { subscription_tier: 'coach_business', stripe_customer_id: null, stripe_subscription_id: null }
    membershipData = { org_id: 'org-1', org_name: 'Test Org', org_slug: 'test-org', role: 'owner' }
    orgMembersData = [{ user_id: 'user-1' }, { user_id: 'coach-2' }, { user_id: 'coach-3' }]
    coachClientsCount = 42
    const res = await GET()
    const json = await res.json()
    expect(json.seat_count).toBe(42)
  })

  it('reports the real number of active org coaches instead of a hardcoded zero', async () => {
    profileData = { subscription_tier: 'wl_starter', stripe_customer_id: null, stripe_subscription_id: null }
    membershipData = { org_id: 'org-1', org_name: 'Test Org', org_slug: 'test-org', role: 'owner' }
    orgMembersData = [{ user_id: 'user-1' }, { user_id: 'coach-2' }]
    const res = await GET()
    const json = await res.json()
    expect(json.coach_seat_count).toBe(2)
    expect(json.included_coaches).toBe(5)
  })
})
