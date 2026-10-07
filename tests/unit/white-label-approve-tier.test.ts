import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Approving used to hardcode white_label_tier: 'starter' regardless of
// what the org actually paid for (wl_starter vs wl_pro). It must now come
// from the application's requested_tier, which the apply route derives
// from the org owner's real Stripe tier.
let orgUpdate: Record<string, unknown> | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'admin-1' } } } }) },
  }),
}))

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/vercel', () => ({ addDomainToVercel: vi.fn(async () => ({ verified: false })) }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { role: 'platform_admin', email: 'admin@test.com' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'white_label_applications') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'app-1',
                  status: 'pending',
                  app_name: 'Pro Gym',
                  custom_domain: null,
                  brand_colour: '#111',
                  brand_colour_secondary: null,
                  logo_url: null,
                  favicon_url: null,
                  app_icon_url: null,
                  support_email: 's@test.com',
                  requested_tier: 'pro',
                  org_id: 'org-1',
                  organisations: { name: 'Pro Gym Org', owner_id: 'owner-1', slug: 'pro-gym' },
                },
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (table === 'organisations') {
        return {
          update: (row: Record<string, unknown>) => {
            orgUpdate = row
            return { eq: async () => ({ error: null }) }
          },
          // Read side, used by notifyClientsOfBrandingChange (fired after
          // the update above) to look up the org's name/slug/domain.
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { name: 'Pro Gym Org', app_name: 'Pro Gym', slug: 'pro-gym', custom_domain: null, custom_domain_verified: false },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'org_members') {
        // No active coaches in this org — notifyClientsOfBrandingChange
        // should resolve to zero sent without reaching coach_clients/profiles.
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: [] }) }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { POST } = await import('@/app/api/admin/white-label/[id]/approve/route')

function fakeRequest(): NextRequest {
  return {} as unknown as NextRequest
}

beforeEach(() => {
  orgUpdate = null
})

describe('POST /api/admin/white-label/[id]/approve — tier from application', () => {
  it('sets organisations.white_label_tier from the application requested_tier, not hardcoded', async () => {
    const res = await POST(fakeRequest(), { params: Promise.resolve({ id: 'app-1' }) })
    expect(res.status).toBe(200)
    expect(orgUpdate).not.toBeNull()
    expect(orgUpdate!.white_label_tier).toBe('pro')
  })

  it('raises coach_seat_limit to match the pro tier (10), not left at the Business default', async () => {
    await POST(fakeRequest(), { params: Promise.resolve({ id: 'app-1' }) })
    expect(orgUpdate!.coach_seat_limit).toBe(10)
  })
})
