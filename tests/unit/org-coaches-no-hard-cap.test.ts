import { describe, it, expect, vi } from 'vitest'
import type { NextRequest } from 'next/server'

// Inviting a coach past the org's included seat count used to be hard
// blocked with a 403 before the invite was even created — which meant the
// advertised "+$19/mo per extra coach" (and the equivalent wl_starter/
// wl_pro overage) could never actually bill, since the metered billing in
// app/api/org/invite/[token]/route.ts only runs on acceptance, which this
// block prevented from ever being reached. Stripe already has overage
// prices configured for all three tiers, so the fix is removing the cap,
// not rewriting the pricing copy.

const insertedInvites: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-user' } } } }) },
  }),
}))

vi.mock('@/lib/org', () => ({
  requireOrgRole: async () => ({ org_id: 'org-1', org_name: 'Test Org', org_slug: 'test-org', role: 'owner' }),
  getCoachPermissions: async () => ({
    can_view_all_clients: false, can_reassign_clients: false, can_use_org_templates: true,
    can_message_all_clients: false, can_view_org_analytics: false,
  }),
}))

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => {}) }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return {
          // Well past any tier's included coach count (3/5/10) — if a cap
          // were still enforced here, the invite would be refused.
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { name: 'Test Org' } }),
              // Hit by getOrgFrontDoorUrl (branded invite links) — not
              // white-labelled here, so it falls back to the plain app URL.
              maybeSingle: async () => ({ data: { slug: 'test-org', is_white_label: false, custom_domain: null, custom_domain_verified: false } }),
            }),
          }),
        }
      }
      if (table === 'org_invites') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ gt: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }),
          insert: (row: Record<string, unknown>) => {
            insertedInvites.push(row)
            return { select: () => ({ single: async () => ({ data: { token: 'tok-1' }, error: null }) }) }
          },
        }
      }
      throw new Error(`unexpected table in test: ${table}`)
    },
  }),
}))

const { POST } = await import('@/app/api/org/coaches/route')

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

describe('POST /api/org/coaches — no hard seat cap', () => {
  it('succeeds inviting a coach even for an org already over its included seat count', async () => {
    const res = await POST(fakeRequest({ email: 'extra-coach@example.com' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(insertedInvites).toHaveLength(1)
  })
})
