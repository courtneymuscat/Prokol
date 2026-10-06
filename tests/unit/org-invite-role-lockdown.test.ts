import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// There is no longer an assignable 'admin' org role — every invited coach
// must land as role: 'coach' regardless of what a client sends. This test
// drives the actual POST handler with a request body that tries to sneak
// 'admin' through, and asserts the row written to org_invites is 'coach'.

const insertedInvites: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'owner-user' } } } }),
    },
  }),
}))

vi.mock('@/lib/org', () => ({
  requireOrgRole: async () => ({ org_id: 'org-1', org_name: 'Test Org', org_slug: 'test-org', role: 'owner' }),
  getCoachPermissions: async () => ({
    can_view_all_clients: false,
    can_reassign_clients: false,
    can_use_org_templates: true,
    can_message_all_clients: false,
    can_view_org_analytics: false,
  }),
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => {}),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { coach_seat_count: 0, coach_seat_limit: 5, name: 'Test Org' } }),
              // Also hit by getOrgFrontDoorUrl (branded invite links) —
              // not white-labelled here, so invites fall back to the plain app URL.
              maybeSingle: async () => ({ data: { slug: 'test-org', is_white_label: false, custom_domain: null, custom_domain_verified: false } }),
            }),
          }),
        }
      }
      if (table === 'org_invites') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  gt: () => ({
                    maybeSingle: async () => ({ data: null }), // no existing invite — forces the insert path
                  }),
                }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            insertedInvites.push(row)
            return {
              select: () => ({
                single: async () => ({ data: { token: 'tok-1' }, error: null }),
              }),
            }
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

beforeEach(() => {
  insertedInvites.length = 0
})

describe('POST /api/org/coaches — role lockdown', () => {
  it('forces role to "coach" even if the request body sends "admin"', async () => {
    const res = await POST(fakeRequest({ email: 'new-coach@example.com', role: 'admin' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(insertedInvites).toHaveLength(1)
    expect(insertedInvites[0].role).toBe('coach')
  })

  it('forces role to "coach" when no role is sent at all', async () => {
    const res = await POST(fakeRequest({ email: 'another-coach@example.com' }))
    expect(res.status).toBe(200)
    expect(insertedInvites[0].role).toBe('coach')
  })
})
