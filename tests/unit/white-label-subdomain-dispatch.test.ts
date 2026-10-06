import { describe, it, expect, vi } from 'vitest'

// isWhiteLabelDomain/fetchOrgByDomain decide whether a {slug}.prokol.io
// subdomain (free, zero-DNS) or a custom domain (requires verified DNS)
// resolves to an org's branding — this is the core of the free-subdomain
// feature, so it must never require custom_domain_verified for a subdomain
// lookup, and must never match the bare prokol.io/vercel.app hosts.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const fixtures: Record<string, Record<string, unknown>[]> = {
        organisations: [
          { id: 'org-1', slug: 'court', name: 'COURT', app_name: 'Court', is_white_label: true, custom_domain: 'app.court.com', custom_domain_verified: true, brand_colour: '#111', brand_colour_secondary: null, brand_colour_text: null, logo_url: null, favicon_url: null, app_icon_url: null, support_email: null },
          { id: 'org-2', slug: 'unverified', name: 'Unverified Org', app_name: 'Unverified', is_white_label: true, custom_domain: 'app.unverified.com', custom_domain_verified: false, brand_colour: '#222', brand_colour_secondary: null, brand_colour_text: null, logo_url: null, favicon_url: null, app_icon_url: null, support_email: null },
          { id: 'org-3', slug: 'notwl', name: 'Not White Label', app_name: null, is_white_label: false, custom_domain: null, custom_domain_verified: false, brand_colour: '#333', brand_colour_secondary: null, brand_colour_text: null, logo_url: null, favicon_url: null, app_icon_url: null, support_email: null },
        ],
      }
      let rows = [...(fixtures[table] ?? [])]
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => { rows = rows.filter((r) => r[col] === val); return builder },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      }
      return builder
    },
  }),
}))

const { isWhiteLabelDomain, fetchOrgByDomain } = await import('@/lib/whitelabel')

describe('isWhiteLabelDomain', () => {
  it('excludes the bare platform domain and previews', () => {
    expect(isWhiteLabelDomain('prokol.io')).toBe(false)
    expect(isWhiteLabelDomain('www.prokol.io')).toBe(false)
    expect(isWhiteLabelDomain('my-branch.vercel.app')).toBe(false)
    expect(isWhiteLabelDomain('localhost:3000')).toBe(false)
  })

  it('treats {slug}.prokol.io subdomains and custom domains as candidates', () => {
    expect(isWhiteLabelDomain('court.prokol.io')).toBe(true)
    expect(isWhiteLabelDomain('app.theirgym.com')).toBe(true)
  })
})

describe('fetchOrgByDomain', () => {
  it('resolves a {slug}.prokol.io subdomain without requiring custom_domain_verified', async () => {
    // org-2 has custom_domain_verified: false, but is looked up by slug via
    // its free subdomain here — verification status must not matter.
    const result = await fetchOrgByDomain('unverified.prokol.io')
    expect(result?.id).toBe('org-2')
  })

  it('resolves a custom domain only when verified', async () => {
    const verified = await fetchOrgByDomain('app.court.com')
    expect(verified?.id).toBe('org-1')
  })

  it('does not resolve an unverified custom domain', async () => {
    const unverified = await fetchOrgByDomain('app.unverified.com')
    expect(unverified).toBeNull()
  })

  it('does not resolve a subdomain for an org that is not white-labelled', async () => {
    const result = await fetchOrgByDomain('notwl.prokol.io')
    expect(result).toBeNull()
  })
})
