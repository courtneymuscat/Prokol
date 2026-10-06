import { describe, it, expect, vi, beforeEach } from 'vitest'

// getOrgFrontDoorUrl picks the URL an invite link should point to — the
// only chance to show an org's own branding to someone who has no account
// yet (branding-follows-login can't help, there's no account to look up).
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
  orgRow = { slug: 'pro-gym', is_white_label: true, custom_domain: null, custom_domain_verified: false }
})

describe('getOrgFrontDoorUrl', () => {
  it('returns the free subdomain when there is no verified custom domain', async () => {
    expect(await getOrgFrontDoorUrl('org-1')).toBe('https://pro-gym.prokol.io')
  })

  it('prefers a verified custom domain over the subdomain', async () => {
    orgRow = { ...orgRow, custom_domain: 'app.progym.com', custom_domain_verified: true }
    expect(await getOrgFrontDoorUrl('org-1')).toBe('https://app.progym.com')
  })

  it('falls back to the subdomain when the custom domain is set but not yet verified', async () => {
    orgRow = { ...orgRow, custom_domain: 'app.progym.com', custom_domain_verified: false }
    expect(await getOrgFrontDoorUrl('org-1')).toBe('https://pro-gym.prokol.io')
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
