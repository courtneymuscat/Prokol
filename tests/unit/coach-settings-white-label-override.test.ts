import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Once a coach's org goes white-label, organisations.* branding overrides
// their personal profiles.brand_colour/logo_url/brand_name everywhere in the
// app shell (see lib/whitelabel.ts's getOrgBrandingForUser) — for the owner
// as much as any member. The personal "Branding" settings form used to stay
// fully editable regardless, silently doing nothing. GET should flag this as
// white_label_override (taking priority over the older org_managed
// member-vs-owner distinction), and PUT should reject attempts to change
// those fields rather than just hiding the form client-side.

let profileData: Record<string, unknown> | null = null
let membershipData: { org_id: string; org_name: string; org_slug: string; role: string } | null = null
let orgData: { is_white_label: boolean; name: string; app_name: string | null; brand_colour: string | null; logo_url: string | null } | null = null

vi.mock('@/lib/coach', () => ({ requireCoach: async () => 'coach-1' }))

vi.mock('@/lib/org', () => ({
  getOrgForUser: async () => membershipData,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'coach-1', email: 'coach@test.com' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: profileData, error: null }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: orgData, error: null }) }) }) }
      }
      if (table === 'org_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { user_id: 'owner-1' } }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { brand_colour: '#000000', logo_url: null, brand_name: 'Owner Brand' }, error: null }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { GET, PUT } = await import('@/app/api/coach/settings/route')

function fakePutRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  profileData = { first_name: 'Court', timezone: null, subscription_tier: 'wl_starter', brand_colour: '#111111', logo_url: null, brand_name: 'Court' }
  membershipData = null
  orgData = null
})

describe('GET /api/coach/settings — white-label override', () => {
  it('flags white_label_override when the org is white-labelled, even for the owner', async () => {
    membershipData = { org_id: 'org-1', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    orgData = { is_white_label: true, name: 'COURT', app_name: 'Be It', brand_colour: '#F5C842', logo_url: 'https://example.com/logo.png' }

    const res = await GET()
    const json = await res.json()

    expect(json.white_label_override).toEqual({
      org_name: 'COURT',
      app_name: 'Be It',
      brand_colour: '#F5C842',
      logo_url: 'https://example.com/logo.png',
    })
    expect(json.org_managed).toBeNull()
  })

  it('falls back to org_managed for a non-owner member of a non-white-label org', async () => {
    membershipData = { org_id: 'org-1', org_name: 'COURT', org_slug: 'court', role: 'coach' }
    orgData = { is_white_label: false, name: 'COURT', app_name: null, brand_colour: null, logo_url: null }

    const res = await GET()
    const json = await res.json()

    expect(json.white_label_override).toBeNull()
    expect(json.org_managed).toMatchObject({ org_name: 'COURT', role: 'coach' })
  })

  it('returns neither when solo with no org', async () => {
    membershipData = null
    const res = await GET()
    const json = await res.json()
    expect(json.white_label_override).toBeNull()
    expect(json.org_managed).toBeNull()
  })
})

describe('PUT /api/coach/settings — blocks branding changes under white-label', () => {
  it('rejects a branding-field change when the org is white-labelled', async () => {
    membershipData = { org_id: 'org-1', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    orgData = { is_white_label: true, name: 'COURT', app_name: 'Be It', brand_colour: '#F5C842', logo_url: null }

    const res = await PUT(fakePutRequest({ brand_colour: '#ABCDEF' }))
    expect(res.status).toBe(400)
  })

  it('still allows non-branding fields (e.g. first_name) when white-labelled', async () => {
    membershipData = { org_id: 'org-1', org_name: 'COURT', org_slug: 'court', role: 'owner' }
    orgData = { is_white_label: true, name: 'COURT', app_name: 'Be It', brand_colour: '#F5C842', logo_url: null }

    const res = await PUT(fakePutRequest({ first_name: 'New Name' }))
    expect(res.status).toBe(200)
  })

  it('allows branding changes when the org is not white-labelled', async () => {
    membershipData = null
    const res = await PUT(fakePutRequest({ brand_colour: '#ABCDEF' }))
    expect(res.status).toBe(200)
  })
})
