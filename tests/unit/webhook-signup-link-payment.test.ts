import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Stripe webhook's checkout.session.completed branch for a one-time
// signup-link purchase (lib/coach.ts's acceptOrgSignupLink, triggered from
// app/program-checkout/[code]/page.tsx) — entirely separate from the
// subscription-tier logic in this same handler. Covers the idempotency
// guard (Stripe's at-least-once delivery must not double-enrol) and that
// it never falls through to the subscription-tier branch.

let sessionOverrides: Record<string, unknown> = {}
let existingPurchase: { id: string } | null = null
const purchaseInserts: Record<string, unknown>[] = []
const acceptCalls: Array<{ code: string; clientId: string }> = []
let subscriptionBranchTouched = false

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: () => ({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            mode: 'payment',
            amount_total: 14900,
            metadata: { signupLinkCode: 'abc123', userId: 'client-1' },
            ...sessionOverrides,
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
  resolveTierFromPrice: async () => null,
}))

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/whitelabel', () => ({ syncWhiteLabelTierForOwner: vi.fn(async () => {}) }))

vi.mock('@/lib/coach', () => ({
  acceptOrgSignupLink: vi.fn(async (code: string, clientId: string) => {
    acceptCalls.push({ code, clientId })
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'org_signup_link_purchases') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: existingPurchase, error: null }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => { purchaseInserts.push(row); return { error: null } },
        }
      }
      if (table === 'org_signup_links') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'link-1' }, error: null }),
            }),
          }),
        }
      }
      // Any table access from the subscription-tier branch below the
      // early-return would mean it wasn't actually skipped.
      subscriptionBranchTouched = true
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
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
  sessionOverrides = {}
  existingPurchase = null
  purchaseInserts.length = 0
  acceptCalls.length = 0
  subscriptionBranchTouched = false
})

describe('Stripe webhook — signup-link one-time payment', () => {
  it('enrols the client and records a purchase row', async () => {
    await POST(fakeRequest())
    expect(acceptCalls).toEqual([{ code: 'abc123', clientId: 'client-1' }])
    expect(purchaseInserts).toHaveLength(1)
    expect(purchaseInserts[0]).toMatchObject({ link_id: 'link-1', client_id: 'client-1', stripe_session_id: 'cs_test_1', amount_cents: 14900 })
  })

  it('never touches the subscription-tier branch for a signup-link payment', async () => {
    await POST(fakeRequest())
    expect(subscriptionBranchTouched).toBe(false)
  })

  it('does not double-enrol on a retried webhook delivery for the same session', async () => {
    existingPurchase = { id: 'purchase-1' }
    await POST(fakeRequest())
    expect(acceptCalls).toHaveLength(0)
    expect(purchaseInserts).toHaveLength(0)
  })

  it('does nothing if userId is missing from metadata', async () => {
    sessionOverrides = { metadata: { signupLinkCode: 'abc123' } }
    await POST(fakeRequest())
    expect(acceptCalls).toHaveLength(0)
  })

  it('ignores subscription-mode sessions even if they somehow carry a signupLinkCode', async () => {
    sessionOverrides = { mode: 'subscription' }
    await POST(fakeRequest())
    expect(acceptCalls).toHaveLength(0)
  })
})
