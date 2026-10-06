import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'

// getOrgBrandingForUser is what makes white-label "seamless" — a coach or
// client who signed up before their org ever went white-label must see the
// right branding the moment they log in, with no special link. It must
// also never reskin the app for a user whose org isn't actually
// white-labelled, or who has no org at all.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const fixtures: Record<string, Record<string, unknown>> = {
        'user-in-wl-org': {
          org_id: 'org-wl',
          organisations: {
            id: 'org-wl', name: 'WL Org', app_name: 'Branded App', slug: 'branded',
            brand_colour: '#111', brand_colour_secondary: null, brand_colour_text: null,
            logo_url: null, favicon_url: null, app_icon_url: null, support_email: null,
            is_white_label: true,
          },
        },
        'user-in-plain-org': {
          org_id: 'org-plain',
          organisations: {
            id: 'org-plain', name: 'Plain Org', app_name: null, slug: 'plain',
            brand_colour: null, brand_colour_secondary: null, brand_colour_text: null,
            logo_url: null, favicon_url: null, app_icon_url: null, support_email: null,
            is_white_label: false,
          },
        },
        'user-no-org': { org_id: null, organisations: null },
      }
      return {
        select: () => ({
          eq: (_col: string, userId: string) => ({
            single: async () => ({ data: fixtures[userId] ?? null, error: null }),
          }),
        }),
      }
    },
  }),
}))

const { getOrgBrandingForUser } = await import('@/lib/whitelabel')

describe('getOrgBrandingForUser', () => {
  it('returns branding for a member of a white-labelled org', async () => {
    const result = await getOrgBrandingForUser('user-in-wl-org')
    expect(result?.app_name).toBe('Branded App')
    expect(result?.id).toBe('org-wl')
    // is_white_label must not leak into the returned branding shape
    expect(result).not.toHaveProperty('is_white_label')
  })

  it('returns null for a member of an org that is not white-labelled', async () => {
    const result = await getOrgBrandingForUser('user-in-plain-org')
    expect(result).toBeNull()
  })

  it('returns null for a user with no org at all', async () => {
    const result = await getOrgBrandingForUser('user-no-org')
    expect(result).toBeNull()
  })
})
