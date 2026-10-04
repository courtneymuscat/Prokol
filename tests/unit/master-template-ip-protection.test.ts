import { describe, it, expect, vi, beforeEach } from 'vitest'

// Dumb-chain, canned-per-table mock. Unlike the other lib/org.ts unit tests,
// this one also needs to support `await admin.from(...).select().eq()...`
// with no terminal .single()/.maybeSingle() (real supabase-js query builders
// are thenable), so the builder implements .then() directly.
let responses: Record<string, unknown> = {}
let singleResponses: Record<string, unknown> = {}
let errors: Record<string, string> = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        is: () => builder,
        limit: () => builder,
        upsert: () => builder,
        delete: () => builder,
        maybeSingle: async () => ({ data: singleResponses[table] ?? null }),
        single: async () => ({ data: singleResponses[table] ?? null }),
        then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
          resolve({ data: (responses[table] as unknown[] | undefined) ?? [], error: errors[table] ? { message: errors[table] } : null }),
      }
      return builder
    },
  }),
}))

const {
  fetchMasterTemplatesForCoach,
  isMasterSourcedForViewer,
  coachHasMasterTemplateAccess,
  grantMasterTemplateAccess,
  revokeMasterTemplateAccess,
} = await import('@/lib/org')

beforeEach(() => {
  responses = {}
  singleResponses = {}
  errors = {}
})

describe('fetchMasterTemplatesForCoach', () => {
  it('returns [] when this coach has no grants in the org', async () => {
    responses.master_template_coach_access = []
    const result = await fetchMasterTemplatesForCoach('gym-org', 'gym-coach')
    expect(result).toEqual([])
  })

  it('returns only name/id/total_steps for templates this coach was granted — never content', async () => {
    responses.master_template_coach_access = [{ template_id: 'template-1' }]
    responses.autoflow_templates = [{ id: 'template-1', name: '12-Week Kickstart', total_steps: 12 }]

    const result = await fetchMasterTemplatesForCoach('gym-org', 'gym-coach')

    expect(result).toEqual([{ id: 'template-1', name: '12-Week Kickstart', total_steps: 12 }])
    for (const row of result) {
      expect(Object.keys(row).sort()).toEqual(['id', 'name', 'total_steps'])
    }
  })
})

describe('coachHasMasterTemplateAccess', () => {
  it('is false with no grant row', async () => {
    singleResponses.master_template_coach_access = null
    expect(await coachHasMasterTemplateAccess('template-1', 'autoflow_templates', 'gym-org', 'gym-coach')).toBe(false)
  })

  it('is true with a matching grant row', async () => {
    singleResponses.master_template_coach_access = { id: 'grant-1' }
    expect(await coachHasMasterTemplateAccess('template-1', 'autoflow_templates', 'gym-org', 'gym-coach')).toBe(true)
  })
})

describe('grantMasterTemplateAccess / revokeMasterTemplateAccess', () => {
  it('grant is rejected when the actor cannot publish this template', async () => {
    singleResponses.profiles = { role: 'coach', org_id: 'court-org' }
    singleResponses.autoflow_templates = { org_id: 'court-org' }

    const result = await grantMasterTemplateAccess('some-coach', 'template-1', 'autoflow_templates', 'gym-org', 'gym-coach')
    expect(result.error).toBe('Forbidden')
  })

  it('grant is rejected when the template was never published to this org', async () => {
    singleResponses.profiles = { role: 'platform_admin', org_id: 'court-org' }
    singleResponses.autoflow_templates = { org_id: 'court-org' }
    singleResponses.master_template_publications = null

    const result = await grantMasterTemplateAccess('court-user', 'template-1', 'autoflow_templates', 'gym-org', 'gym-coach')
    expect(result.error).toBe('Not published to this org')
  })

  it('grant succeeds for a platform admin publishing their own template to an org it was published to', async () => {
    singleResponses.profiles = { role: 'platform_admin', org_id: 'court-org' }
    singleResponses.autoflow_templates = { org_id: 'court-org' }
    singleResponses.master_template_publications = { id: 'pub-1' }

    const result = await grantMasterTemplateAccess('court-user', 'template-1', 'autoflow_templates', 'gym-org', 'gym-coach')
    expect(result.error).toBeUndefined()
  })

  it('revoke is rejected when the actor cannot publish this template', async () => {
    singleResponses.profiles = { role: 'coach', org_id: 'court-org' }
    singleResponses.autoflow_templates = { org_id: 'court-org' }

    const result = await revokeMasterTemplateAccess('some-coach', 'template-1', 'autoflow_templates', 'gym-org', 'gym-coach')
    expect(result.error).toBe('Forbidden')
  })

  it('revoke succeeds for the template owner / platform admin', async () => {
    singleResponses.profiles = { role: 'platform_admin', org_id: 'court-org' }
    singleResponses.autoflow_templates = { org_id: 'court-org' }

    const result = await revokeMasterTemplateAccess('court-user', 'template-1', 'autoflow_templates', 'gym-org', 'gym-coach')
    expect(result.error).toBeUndefined()
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
