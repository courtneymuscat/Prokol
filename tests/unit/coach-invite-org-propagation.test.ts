import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// A client invited by a regular (non-admin) coach who belongs to an org
// never got that org_id persisted onto the invite — only the admin-tagged
// gym-invite path did. The invite *email link* already accounted for the
// coach's own org (via effectiveOrgId), but the actual coach_invites row
// only ever stored the stricter admin-only value, so after acceptance the
// client's own profile.org_id stayed null forever — breaking
// branding-follows-login for every normally-invited client, not just a
// corner case.

let insertedRow: Record<string, unknown> | null = null
let coachProfileOrgId: string | null = 'org-1'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { full_name: 'Coach Name', email: 'coach@test.com', brand_name: null, org_id: coachProfileOrgId },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'coach_invites') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  gt: () => ({ single: async () => ({ data: null, error: { code: 'PGRST116' } }) }),
                }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            insertedRow = row
            return { select: () => ({ single: async () => ({ data: { token: 'tok-1' }, error: null }) }) }
          },
        }
      }
      throw new Error(`unexpected table (server client): ${table}`)
    },
  }),
}))

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => {}) }))
vi.mock('@/lib/billing', () => ({ INCLUDED_SEATS: { coach_business: 75, wl_starter: 200 } }))
vi.mock('@/lib/whitelabel', () => ({ getOrgFrontDoorUrl: vi.fn(async () => null) }))
vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'coach-1' }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              single: async () => {
                if (id === 'coach-1') return { data: { subscription_tier: 'coach_business', role: 'coach' }, error: null }
                return { data: null, error: { code: 'PGRST116' } }
              },
            }),
          }),
          update: () => ({ eq: () => ({ neq: async () => ({ error: null }) }) }),
          upsert: async () => ({ error: null }),
        }
      }
      if (table === 'coach_clients') {
        return {
          select: () => ({ eq: () => ({ in: async () => ({ count: 0 }) }) }),
          upsert: async () => ({ error: null }),
        }
      }
      throw new Error(`unexpected table (admin client): ${table}`)
    },
    auth: { admin: { createUser: async () => ({ data: { user: { id: 'ghost-1' } } }) } },
  }),
}))

const { POST } = await import('@/app/api/coach/invite/route')

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  insertedRow = null
  coachProfileOrgId = 'org-1'
})

describe('POST /api/coach/invite — org_id propagation', () => {
  it('persists the inviting coach\'s own org_id onto the invite, not just an admin tag', async () => {
    await POST(fakeRequest({ email: 'new-client@test.com' }))
    expect(insertedRow).not.toBeNull()
    expect(insertedRow!.org_id).toBe('org-1')
  })

  it('leaves org_id null for a coach with no org', async () => {
    coachProfileOrgId = null
    await POST(fakeRequest({ email: 'new-client@test.com' }))
    expect(insertedRow!.org_id).toBeNull()
  })
})
