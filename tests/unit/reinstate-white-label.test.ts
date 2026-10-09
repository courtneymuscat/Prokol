import { describe, it, expect, vi, beforeEach } from 'vitest'

let orgsData: Record<string, unknown>[] = []
const auditInserts: Record<string, unknown>[] = []
let latestApprovedApp: { requested_tier: string } | null = null

const notifySpy = vi.fn(async () => ({ sent: 0 }))

vi.mock('@/lib/whitelabel', () => ({ notifyClientsOfBrandingChange: notifySpy }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'organisations') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => {
                const row = orgsData[0]
                return { data: row ? { ...row } : null, error: null }
              },
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
      if (table === 'white_label_applications') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: latestApprovedApp, error: null }),
                  }),
                }),
              }),
            }),
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

const { reinstateWhiteLabel } = await import('@/lib/admin')

beforeEach(() => {
  auditInserts.length = 0
  notifySpy.mockClear()
  latestApprovedApp = { requested_tier: 'pro' }
  orgsData = [{
    id: 'org-1',
    is_white_label: false,
    white_label_tier: null,
  }]
})

describe('reinstateWhiteLabel', () => {
  it('turns is_white_label back on using the org\'s latest approved application tier', async () => {
    const result = await reinstateWhiteLabel('org-1', 'admin-1')
    expect(result.success).toBe(true)
    expect(orgsData[0].is_white_label).toBe(true)
    expect(orgsData[0].white_label_tier).toBe('pro')
  })

  it('raises coach_seat_limit to match the reinstated tier', async () => {
    await reinstateWhiteLabel('org-1', 'admin-1')
    expect(orgsData[0].coach_seat_limit).toBe(10)
  })

  it('notifies active clients that branding is live again', async () => {
    await reinstateWhiteLabel('org-1', 'admin-1')
    expect(notifySpy).toHaveBeenCalledWith('org-1')
  })

  it('writes an audit log entry', async () => {
    await reinstateWhiteLabel('org-1', 'admin-1')
    expect(auditInserts).toHaveLength(1)
    expect(auditInserts[0]).toMatchObject({
      admin_id: 'admin-1',
      action: 'reinstate_white_label',
      target_org_id: 'org-1',
      new_value: 'pro',
    })
  })

  it('errors without reinstating when there is no approved application', async () => {
    latestApprovedApp = null
    const result = await reinstateWhiteLabel('org-1', 'admin-1')
    expect(result.error).toBeTruthy()
    expect(orgsData[0].is_white_label).toBe(false)
    expect(notifySpy).not.toHaveBeenCalled()
  })
})
