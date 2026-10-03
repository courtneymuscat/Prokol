import { describe, it, expect, vi, beforeEach } from 'vitest'

// Dumb-chain, canned-per-table mock. Unlike the other lib/org.ts unit tests,
// this one also needs to support `await admin.from(...).select().eq()...`
// with no terminal .single()/.maybeSingle() (real supabase-js query builders
// are thenable), so the builder implements .then() directly.
let responses: Record<string, unknown> = {}
let singleResponses: Record<string, unknown> = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        is: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: singleResponses[table] ?? null }),
        single: async () => ({ data: singleResponses[table] ?? null }),
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: (responses[table] as unknown[] | undefined) ?? [], error: null }),
      }
      return builder
    },
  }),
}))

const { fetchMasterTemplatesForOrg, isMasterSourcedForViewer } = await import('@/lib/org')

beforeEach(() => {
  responses = {}
  singleResponses = {}
})

describe('fetchMasterTemplatesForOrg', () => {
  it('returns [] when nothing is published to the org', async () => {
    responses.master_template_publications = []
    const result = await fetchMasterTemplatesForOrg('gym-org')
    expect(result).toEqual([])
  })

  it('returns only name/id/total_steps for published templates — never questions or step content', async () => {
    responses.master_template_publications = [{ template_id: 'template-1' }]
    responses.autoflow_templates = [{ id: 'template-1', name: '12-Week Kickstart', total_steps: 12 }]

    const result = await fetchMasterTemplatesForOrg('gym-org')

    expect(result).toEqual([{ id: 'template-1', name: '12-Week Kickstart', total_steps: 12 }])
    // Guard against a future edit accidentally widening the select() to
    // include content fields — every key returned must be one of these three.
    for (const row of result) {
      expect(Object.keys(row).sort()).toEqual(['id', 'name', 'total_steps'])
    }
  })
})

describe('isMasterSourcedForViewer', () => {
  it("is false for the template's real owner", async () => {
    const result = await isMasterSourcedForViewer('template-1', 'court-user', 'court-org', false, 'court-user')
    expect(result).toBe(false)
  })

  it('is false for ordinary within-org sharing (same org_id, is_org_template)', async () => {
    singleResponses.org_members = { org_id: 'biz-org', role: 'coach', organisations: { name: 'Biz', slug: 'biz' } }
    const result = await isMasterSourcedForViewer('template-1', 'owner-user', 'biz-org', true, 'coach-in-biz-org')
    expect(result).toBe(false)
  })

  it('is false when the viewer has no org at all', async () => {
    singleResponses.org_members = null
    const result = await isMasterSourcedForViewer('template-1', 'court-user', 'court-org', false, 'solo-coach')
    expect(result).toBe(false)
  })

  it('is false when the viewer is in an org but nothing was published to it', async () => {
    singleResponses.org_members = { org_id: 'gym-org', role: 'coach', organisations: { name: 'Gym', slug: 'gym' } }
    singleResponses.master_template_publications = null
    const result = await isMasterSourcedForViewer('template-1', 'court-user', 'court-org', false, 'gym-coach')
    expect(result).toBe(false)
  })

  it("is true when a master_template_publications row matches the viewer's org", async () => {
    singleResponses.org_members = { org_id: 'gym-org', role: 'coach', organisations: { name: 'Gym', slug: 'gym' } }
    singleResponses.master_template_publications = { id: 'pub-1' }
    const result = await isMasterSourcedForViewer('template-1', 'court-user', 'court-org', false, 'gym-coach')
    expect(result).toBe(true)
  })
})
