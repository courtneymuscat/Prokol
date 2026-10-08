import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Downgrading away from a white-label tier (e.g. wl_starter -> coach_business)
// used to only null organisations.white_label_tier while leaving
// is_white_label stuck true — a cancelled org kept full branding/domain
// access despite no longer paying for it. That logic now lives in
// lib/whitelabel.ts's syncWhiteLabelTierForOwner (shared with the
// change-plan route, which calls it synchronously for the same reason —
// see that function's own doc comment); this test just verifies the
// webhook calls it correctly with the real previous/new tier.

let profileRow: Record<string, unknown> | null = null
const syncCalls: { ownerId: string; prevTier: string; newTier: string }[] = []

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: () => ({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_1',
            items: { data: [{ price: { id: 'price_business' } }] },
          },
        },
      }),
    },
  }),
  buildPriceToTierMap: () => ({}),
  OVERAGE_PRICE_IDS: new Set(),
  TIER_TO_USER_TYPE: {},
}))

vi.mock('@/lib/billing', () => ({
  TIER_TO_METER_EVENT: {},
  resolveTierFromPrice: async () => 'coach_business',
}))

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => {}) }))

vi.mock('@/lib/whitelabel', () => ({
  syncWhiteLabelTierForOwner: vi.fn(async (ownerId: string, prevTier: string, newTier: string) => {
    syncCalls.push({ ownerId, prevTier, newTier })
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: profileRow, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              select: async () => {
                if (profileRow) Object.assign(profileRow, patch)
                return { data: [{ id: 'coach-1' }], error: null }
              },
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { POST } = await import('@/app/api/stripe/webhook/route')

function fakeRequest(): NextRequest {
  return {
    text: async () => '{}',
    headers: { get: () => 'sig' },
  } as unknown as NextRequest
}

beforeEach(() => {
  syncCalls.length = 0
  profileRow = { id: 'coach-1', subscription_tier: 'wl_starter', email: 'coach@test.com', full_name: 'Coach' }
})

describe('Stripe webhook — subscription.updated', () => {
  it('calls syncWhiteLabelTierForOwner with the real previous and new tier', async () => {
    await POST(fakeRequest())
    expect(syncCalls).toHaveLength(1)
    expect(syncCalls[0]).toEqual({ ownerId: 'coach-1', prevTier: 'wl_starter', newTier: 'coach_business' })
  })

  it('does not call it when the tier did not actually change', async () => {
    profileRow = { id: 'coach-1', subscription_tier: 'coach_business', email: 'coach@test.com', full_name: 'Coach' }
    await POST(fakeRequest())
    expect(syncCalls).toHaveLength(0)
  })
})
