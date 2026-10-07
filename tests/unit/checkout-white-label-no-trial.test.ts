import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// White-label is a premium add-on almost always chosen by someone who
// already knows they want it — a 14-day free trial fits brand-new coach
// signups evaluating the core product, not this. Existing subscribers are
// routed through the Billing Portal anyway (no trial there either); this
// only matters for someone with no active subscription going straight for
// white-label.
let capturedParams: Record<string, unknown> | null = null

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          capturedParams = params
          return { url: 'https://checkout.stripe.com/test' }
        },
      },
    },
  }),
  getStripePriceId: () => 'price_123',
  getStripeOveragePriceId: () => null,
}))

const profileData = { stripe_customer_id: null, stripe_subscription_id: null }
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: profileData, error: null }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}))

const { POST } = await import('@/app/api/stripe/checkout/route')

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  capturedParams = null
})

describe('POST /api/stripe/checkout — white-label trial exclusion', () => {
  it('does not grant a trial for wl_starter', async () => {
    await POST(fakeRequest({ planKey: 'wl_starter', billing: 'monthly', userType: 'coach' }))
    const subData = capturedParams?.subscription_data as Record<string, unknown>
    expect(subData.trial_period_days).toBeUndefined()
  })

  it('does not grant a trial for wl_pro', async () => {
    await POST(fakeRequest({ planKey: 'wl_pro', billing: 'monthly', userType: 'coach' }))
    const subData = capturedParams?.subscription_data as Record<string, unknown>
    expect(subData.trial_period_days).toBeUndefined()
  })

  it('still grants a trial for a regular coach plan', async () => {
    await POST(fakeRequest({ planKey: 'coach_business', billing: 'monthly', userType: 'coach' }))
    const subData = capturedParams?.subscription_data as Record<string, unknown>
    expect(subData.trial_period_days).toBe(14)
  })
})
