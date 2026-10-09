import { describe, it, expect, vi, beforeEach } from 'vitest'

// getOrgFrontDoorUrl picks the URL (and display name) an invite/join link
// should use. Always the plain app URL now that domains/subdomains have
// been removed entirely — branding-follows-login can't help here (there's
// no account yet to look up), so an invite recipient's very first screen
// is unbranded Prokol regardless; a known, accepted trade-off.
let orgRow: Record<string, unknown> | null = null

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: orgRow, error: null }),
        }),
      }),
    }),
  }),
}))

const { getOrgFrontDoorUrl } = await import('@/lib/whitelabel')

beforeEach(() => {
  orgRow = { name: 'Pro Gym Org', app_name: 'Pro Gym', is_white_label: true }
})

describe('getOrgFrontDoorUrl', () => {
  it('returns the plain app URL for a white-labelled org', async () => {
    const result = await getOrgFrontDoorUrl('org-1')
    expect(result?.appName).toBe('Pro Gym')
    expect(result?.url).toMatch(/^https:\/\//)
  })

  it('falls back to the org name when app_name is not set', async () => {
    orgRow = { ...orgRow, app_name: null }
    expect((await getOrgFrontDoorUrl('org-1'))?.appName).toBe('Pro Gym Org')
  })

  it('returns null for an org that is not white-labelled', async () => {
    orgRow = { ...orgRow, is_white_label: false }
    expect(await getOrgFrontDoorUrl('org-1')).toBeNull()
  })

  it('returns null when the org cannot be found', async () => {
    orgRow = null
    expect(await getOrgFrontDoorUrl('org-1')).toBeNull()
  })
})
