import { describe, it, expect, vi, beforeEach } from 'vitest'

// Two real billing gaps found while verifying white-label's advertised
// 5/10-coach, 200/500-client allowance actually works:
//  1. reportCoachSeatUsage always reported coach overage to
//     'coach_business_coach_overage' regardless of the owner's real tier.
//  2. reportWhiteLabelSeatUsage (now reportWhiteLabelClientSeatUsage) read
//     organisations.subscription_tier — a column constrained to legacy
//     'org_starter'/'org_enterprise' values and never actually set to a wl
//     tier — so it could never fire. Fixed to key off
//     is_white_label + white_label_tier ('starter'/'pro') instead.

const meterEvents: { event_name: string; stripe_customer_id: string }[] = []

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    billing: {
      meterEvents: {
        create: async (opts: { event_name: string; payload: { stripe_customer_id: string } }) => {
          meterEvents.push({ event_name: opts.event_name, stripe_customer_id: opts.payload.stripe_customer_id })
        },
      },
    },
  }),
  buildPriceToTierMap: () => ({}),
  OVERAGE_PRICE_IDS: new Set(),
  TIER_TO_USER_TYPE: {},
}))

let ownerMembershipData: { user_id: string } | null = null
let profilesData: Record<string, Record<string, unknown>> = {}
let orgsData: Record<string, Record<string, unknown>> = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'org_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: ownerMembershipData, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              single: async () => ({ data: profilesData[id] ?? null, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              if (profilesData[id]) Object.assign(profilesData[id], patch)
              return { error: null }
            },
          }),
        }
      }
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              single: async () => ({ data: orgsData[id] ?? null, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              if (orgsData[id]) Object.assign(orgsData[id], patch)
              return { error: null }
            },
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { reportCoachSeatUsage, reportWhiteLabelClientSeatUsage } = await import('@/lib/billing')

beforeEach(() => {
  meterEvents.length = 0
  ownerMembershipData = { user_id: 'owner-1' }
  profilesData = {
    'owner-1': { stripe_customer_id: 'cus_1', subscription_tier: 'wl_starter', org_coach_seat_count: 5 },
  }
  orgsData = {
    'org-1': { is_white_label: true, white_label_tier: 'starter', client_seat_count: 200, owner_id: 'owner-1' },
  }
})

describe('reportCoachSeatUsage — correct meter event per tier', () => {
  it('reports wl_starter coach overage to wl_starter_coach_overage, not coach_business', async () => {
    await reportCoachSeatUsage('org-1')
    expect(meterEvents).toHaveLength(1)
    expect(meterEvents[0].event_name).toBe('wl_starter_coach_overage')
  })

  it('still reports coach_business owners to coach_business_coach_overage', async () => {
    profilesData['owner-1'].subscription_tier = 'coach_business'
    profilesData['owner-1'].org_coach_seat_count = 3
    await reportCoachSeatUsage('org-1')
    expect(meterEvents[0].event_name).toBe('coach_business_coach_overage')
  })

  it('does not fire a meter event under the included seat threshold', async () => {
    profilesData['owner-1'].org_coach_seat_count = 0
    await reportCoachSeatUsage('org-1')
    expect(meterEvents).toHaveLength(0)
  })
})

describe('reportWhiteLabelClientSeatUsage — reads the real white-label columns', () => {
  it('fires wl_starter_client_overage once past the 200-client included limit', async () => {
    await reportWhiteLabelClientSeatUsage('org-1')
    expect(meterEvents).toHaveLength(1)
    expect(meterEvents[0]).toMatchObject({ event_name: 'wl_starter_client_overage', stripe_customer_id: 'cus_1' })
  })

  it('increments organisations.client_seat_count', async () => {
    await reportWhiteLabelClientSeatUsage('org-1')
    expect(orgsData['org-1'].client_seat_count).toBe(201)
  })

  it('does not fire under the included client limit', async () => {
    orgsData['org-1'].client_seat_count = 50
    await reportWhiteLabelClientSeatUsage('org-1')
    expect(meterEvents).toHaveLength(0)
  })

  it('does nothing for a non-white-labelled org', async () => {
    orgsData['org-1'].is_white_label = false
    await reportWhiteLabelClientSeatUsage('org-1')
    expect(meterEvents).toHaveLength(0)
    expect(orgsData['org-1'].client_seat_count).toBe(200)
  })

  it('uses the pro tier limit (500) and event name', async () => {
    orgsData['org-1'] = { is_white_label: true, white_label_tier: 'pro', client_seat_count: 500, owner_id: 'owner-1' }
    await reportWhiteLabelClientSeatUsage('org-1')
    expect(meterEvents[0].event_name).toBe('wl_pro_client_overage')
  })
})
