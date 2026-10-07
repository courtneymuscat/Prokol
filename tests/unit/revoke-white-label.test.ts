import { describe, it, expect, vi, beforeEach } from 'vitest'

let orgsData: Record<string, unknown>[] = []
const auditInserts: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        let rows = [...orgsData]
        return {
          select: () => ({
            eq: () => ({
              // Shallow-copy so capturing "current" before the later
              // update() isn't retroactively affected by that mutation —
              // the real Supabase client returns independent data per call.
              single: async () => ({ data: rows[0] ? { ...rows[0] } : null, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              const row = orgsData.find((r) => r.id === id)
              if (row) Object.assign(row, patch)
              return { error: null }
            },
          }),
        }
      }
      if (table === 'admin_audit_log') {
        return { insert: async (row: Record<string, unknown>) => { auditInserts.push(row); return { error: null } } }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { revokeWhiteLabel } = await import('@/lib/admin')

beforeEach(() => {
  auditInserts.length = 0
  orgsData = [{
    id: 'org-1',
    is_white_label: true,
    white_label_tier: 'pro',
    custom_domain: 'app.gym.com',
    app_name: 'Gym App',
    logo_url: 'https://example.com/logo.png',
  }]
})

describe('revokeWhiteLabel', () => {
  it('turns off is_white_label and clears the tier', async () => {
    const result = await revokeWhiteLabel('org-1', 'admin-1')
    expect(result.success).toBe(true)
    expect(orgsData[0].is_white_label).toBe(false)
    expect(orgsData[0].white_label_tier).toBeNull()
  })

  it('drops coach_seat_limit back to the Business default', async () => {
    await revokeWhiteLabel('org-1', 'admin-1')
    expect(orgsData[0].coach_seat_limit).toBe(3)
  })

  it('leaves custom_domain, app_name, and branding assets untouched', async () => {
    await revokeWhiteLabel('org-1', 'admin-1')
    expect(orgsData[0].custom_domain).toBe('app.gym.com')
    expect(orgsData[0].app_name).toBe('Gym App')
    expect(orgsData[0].logo_url).toBe('https://example.com/logo.png')
  })

  it('writes an audit log entry recording the previous tier', async () => {
    await revokeWhiteLabel('org-1', 'admin-1')
    expect(auditInserts).toHaveLength(1)
    expect(auditInserts[0]).toMatchObject({
      admin_id: 'admin-1',
      action: 'revoke_white_label',
      target_org_id: 'org-1',
      old_value: 'pro',
      new_value: null,
    })
  })
})
