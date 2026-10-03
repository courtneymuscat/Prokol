import { describe, it, expect, vi, beforeEach } from 'vitest'

// Same "dumb chain, canned per-table responses" mock style as
// gym-permissions.test.ts, extended with insert/delete passthroughs and a
// record of what got inserted (so we can assert on audit-log writes).
let responses: Record<string, unknown> = {}
let inserted: Record<string, unknown[]> = {}
let deleted: Record<string, true> = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: responses[table] ?? null }),
        single: async () => ({ data: responses[table] ?? null, error: responses[`${table}__error`] ?? null }),
        insert: (row: unknown) => {
          inserted[table] = inserted[table] ?? []
          inserted[table].push(row)
          return builder
        },
        delete: () => {
          deleted[table] = true
          return { ...builder, eq: async () => ({ error: null }) }
        },
      }
      return builder
    },
  }),
}))

const { publishMasterTemplate, unpublishMasterTemplate } = await import('@/lib/org')

beforeEach(() => {
  responses = {}
  inserted = {}
  deleted = {}
})

describe('publishMasterTemplate', () => {
  it('rejects when the caller cannot publish (not platform admin / wrong org)', async () => {
    responses.profiles = { role: 'coach', org_id: 'court-org' }
    responses.autoflow_templates = { org_id: 'court-org' }

    const result = await publishMasterTemplate('some-coach', 'template-1', 'autoflow_templates', 'gym-org')

    expect(result.error).toBe('Forbidden')
    expect(inserted.master_template_publications).toBeUndefined()
  })

  it('inserts the publication and an audit log entry when allowed', async () => {
    responses.profiles = { role: 'platform_admin', org_id: 'court-org' }
    responses.autoflow_templates = { org_id: 'court-org' }
    responses.master_template_publications = { id: 'pub-1' }

    const result = await publishMasterTemplate('court-user', 'template-1', 'autoflow_templates', 'gym-org')

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ id: 'pub-1' })
    expect(inserted.master_template_publications).toHaveLength(1)
    expect(inserted.master_template_publications[0]).toMatchObject({
      template_id: 'template-1',
      template_table: 'autoflow_templates',
      org_id: 'gym-org',
      published_by: 'court-user',
    })
    expect(inserted.admin_audit_log).toHaveLength(1)
    expect(inserted.admin_audit_log[0]).toMatchObject({ action: 'publish_master_template', target_org_id: 'gym-org' })
  })
})

describe('unpublishMasterTemplate', () => {
  it('rejects a non-platform-admin', async () => {
    responses.profiles = { role: 'coach' }

    const result = await unpublishMasterTemplate('some-coach', 'pub-1')

    expect(result.error).toBe('Forbidden')
    expect(deleted.master_template_publications).toBeUndefined()
  })

  it('deletes the publication and logs it for a platform admin', async () => {
    responses.profiles = { role: 'platform_admin' }
    responses.master_template_publications = { org_id: 'gym-org', template_id: 'template-1', template_table: 'autoflow_templates' }

    const result = await unpublishMasterTemplate('court-user', 'pub-1')

    expect(result.error).toBeUndefined()
    expect(deleted.master_template_publications).toBe(true)
    expect(inserted.admin_audit_log).toHaveLength(1)
    expect(inserted.admin_audit_log[0]).toMatchObject({ action: 'unpublish_master_template', target_org_id: 'gym-org' })
  })
})
