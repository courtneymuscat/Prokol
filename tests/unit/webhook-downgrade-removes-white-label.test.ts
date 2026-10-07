import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Downgrading away from a white-label tier (e.g. wl_starter -> coach_business)
// used to only null organisations.white_label_tier while leaving
// is_white_label stuck true — a cancelled org kept full branding/domain
// access despite no longer paying for it. Must actually turn it off.

let profileRow: Record<string, unknown> | null = null
let orgRow: Record<string, unknown> | null = null
let orgUpdatePatch: Record<string, unknown> | null = null
const sentEmails: { to: string; subject: string }[] = []

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
  WHITE_LABEL_COACH_SEAT_LIMIT: { starter: 5, pro: 10 },
  DEFAULT_COACH_SEAT_LIMIT: 3,
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async (opts: { to: string; subject: string }) => { sentEmails.push(opts) }),
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
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: orgRow, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => { orgUpdatePatch = patch; if (orgRow) Object.assign(orgRow, patch); return { error: null } },
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
  sentEmails.length = 0
  orgUpdatePatch = null
  profileRow = { id: 'coach-1', subscription_tier: 'wl_starter', email: 'coach@test.com', full_name: 'Coach' }
  orgRow = { id: 'org-1', is_white_label: true, name: 'Test Org' }
})

describe('Stripe webhook — downgrading away from white-label', () => {
  it('turns off is_white_label, not just the tier', async () => {
    await POST(fakeRequest())
    expect(orgUpdatePatch).toMatchObject({ is_white_label: false, white_label_tier: null, coach_seat_limit: 3 })
  })

  it('emails the owner that their branding was switched off', async () => {
    await POST(fakeRequest())
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0].to).toBe('coach@test.com')
    expect(sentEmails[0].subject).toContain('turned off')
  })

  it('does nothing to a non-white-labelled org', async () => {
    orgRow = { id: 'org-1', is_white_label: false, name: 'Test Org' }
    await POST(fakeRequest())
    expect(orgUpdatePatch).toBeNull()
    expect(sentEmails).toHaveLength(0)
  })
})
