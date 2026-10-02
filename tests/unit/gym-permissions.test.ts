import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fake admin client keyed by table name — each test configures exactly one
// row per table it touches, so a dumb chain that ignores .eq() filters and
// just returns the configured row is enough (and keeps these tests readable).
let responses: Record<string, unknown> = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: responses[table] ?? null }),
        single: async () => ({ data: responses[table] ?? null }),
      }
      return builder
    },
  }),
}))

const { getOrgTenantType, getEffectiveCoachPermissions, canPublishMasterTemplate } = await import('@/lib/org')

beforeEach(() => {
  responses = {}
})

describe('getOrgTenantType', () => {
  it('returns the tenant_type for an existing org', async () => {
    responses.organisations = { tenant_type: 'gym' }
    expect(await getOrgTenantType('org-1')).toBe('gym')
  })

  it('returns null for a non-existent org', async () => {
    responses.organisations = null
    expect(await getOrgTenantType('missing')).toBeNull()
  })
})

describe('getEffectiveCoachPermissions', () => {
  it('forces health-data grants off for a gym org regardless of stored permissions', async () => {
    responses.organisations = { tenant_type: 'gym' }
    responses.org_coach_permissions = {
      can_view_all_clients: true,
      can_reassign_clients: true,
      can_use_org_templates: true,
      can_message_all_clients: true,
      can_view_org_analytics: true,
    }

    const perms = await getEffectiveCoachPermissions('coach-1', 'org-1')

    expect(perms.can_view_all_clients).toBe(false)
    expect(perms.can_reassign_clients).toBe(false)
    expect(perms.can_message_all_clients).toBe(false)
    // These two stay configurable even for a gym — templates and aggregate
    // analytics aren't health data, and the brief explicitly allows them.
    expect(perms.can_use_org_templates).toBe(true)
    expect(perms.can_view_org_analytics).toBe(true)
  })

  it('leaves a coaching_business org unaffected', async () => {
    responses.organisations = { tenant_type: 'coaching_business' }
    responses.org_coach_permissions = {
      can_view_all_clients: true,
      can_reassign_clients: true,
      can_use_org_templates: true,
      can_message_all_clients: true,
      can_view_org_analytics: true,
    }

    const perms = await getEffectiveCoachPermissions('coach-1', 'org-1')

    expect(perms.can_view_all_clients).toBe(true)
    expect(perms.can_reassign_clients).toBe(true)
    expect(perms.can_message_all_clients).toBe(true)
  })

  it('defaults to all-false permissions when no permission row exists yet', async () => {
    responses.organisations = { tenant_type: 'coaching_business' }
    responses.org_coach_permissions = null

    const perms = await getEffectiveCoachPermissions('coach-1', 'org-1')

    expect(perms.can_view_all_clients).toBe(false)
  })
})

describe('canPublishMasterTemplate', () => {
  it('allows a platform admin to publish a template that belongs to their own org', async () => {
    responses.profiles = { role: 'platform_admin', org_id: 'court-org' }
    responses.autoflow_templates = { org_id: 'court-org' }

    expect(await canPublishMasterTemplate('court-user', 'template-1', 'autoflow_templates')).toBe(true)
  })

  it('blocks a platform admin from publishing a template owned by a different org', async () => {
    responses.profiles = { role: 'platform_admin', org_id: 'court-org' }
    responses.autoflow_templates = { org_id: 'some-gym-org' }

    expect(await canPublishMasterTemplate('court-user', 'template-1', 'autoflow_templates')).toBe(false)
  })

  it('blocks a non-platform-admin even if the template belongs to their own org', async () => {
    responses.profiles = { role: 'coach', org_id: 'court-org' }
    responses.autoflow_templates = { org_id: 'court-org' }

    expect(await canPublishMasterTemplate('some-coach', 'template-1', 'autoflow_templates')).toBe(false)
  })

  it('blocks when the user has no org at all', async () => {
    responses.profiles = { role: 'platform_admin', org_id: null }
    responses.autoflow_templates = { org_id: 'court-org' }

    expect(await canPublishMasterTemplate('court-user', 'template-1', 'autoflow_templates')).toBe(false)
  })
})
