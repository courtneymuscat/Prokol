import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fake postgrest builder that actually mutates a shared `data` array on
// insert/update/delete, so cross-org isolation can be verified by checking
// the underlying fixture afterward — not just inspecting what was returned.
function makeLeadsBuilder(data: Record<string, unknown>[]) {
  let rows = [...data]
  let mode: 'select' | 'update' | 'delete' = 'select'
  let updatePayload: Record<string, unknown> = {}

  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val)
      return builder
    },
    is: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val)
      return builder
    },
    order: () => builder,
    update: (payload: Record<string, unknown>) => {
      mode = 'update'
      updatePayload = payload
      return builder
    },
    delete: () => {
      mode = 'delete'
      return builder
    },
    insert: (payload: Record<string, unknown>) => {
      const row = { id: `new-${data.length}`, created_at: new Date().toISOString(), ...payload }
      data.push(row)
      return { select: () => ({ single: async () => ({ data: row, error: null }) }) }
    },
    single: async () => {
      if (mode === 'update') {
        if (rows.length === 0) return { data: null, error: { message: 'No rows found' } }
        Object.assign(rows[0], updatePayload)
        return { data: rows[0], error: null }
      }
      return { data: rows[0] ?? null, error: null }
    },
    then: (resolve: (v: { data: unknown; error: null }) => void) => {
      if (mode === 'delete') {
        for (const r of rows) {
          const idx = data.indexOf(r)
          if (idx !== -1) data.splice(idx, 1)
        }
      }
      resolve({ data: rows, error: null })
    },
  }
  return builder
}

let leadsData: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'leads') return makeLeadsBuilder(leadsData)
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { listOrgLeads, createOrgLead, updateOrgLead, deleteOrgLead } = await import('@/lib/org')

beforeEach(() => {
  leadsData = [
    { id: 'lead-a1', org_id: 'org-A', name: 'Alice', email: null, phone: null, source: 'other', status: 'new', notes: null, follow_up_done: false, follow_up_date: null, created_at: '2026-01-01' },
    { id: 'lead-b1', org_id: 'org-B', name: 'Bob', email: null, phone: null, source: 'other', status: 'new', notes: null, follow_up_done: false, follow_up_date: null, created_at: '2026-01-01' },
  ]
})

describe('org leads: cross-org isolation', () => {
  it('listOrgLeads only returns the requested org\'s leads', async () => {
    expect((await listOrgLeads('org-A')).map((l) => l.id)).toEqual(['lead-a1'])
    expect((await listOrgLeads('org-B')).map((l) => l.id)).toEqual(['lead-b1'])
  })

  it('createOrgLead tags the new lead with the given org_id', async () => {
    await createOrgLead('org-A', 'user-1', { name: 'New Prospect' })
    const inserted = leadsData.find((l) => l.name === 'New Prospect')
    expect(inserted?.org_id).toBe('org-A')
  })

  it('updateOrgLead cannot touch another org\'s lead by id', async () => {
    const result = await updateOrgLead('org-A', 'lead-b1', { name: 'Hacked' })
    expect(result.error).toBeTruthy()
    expect(leadsData.find((l) => l.id === 'lead-b1')?.name).toBe('Bob')
  })

  it('deleteOrgLead cannot delete another org\'s lead by id', async () => {
    await deleteOrgLead('org-A', 'lead-b1')
    expect(leadsData.find((l) => l.id === 'lead-b1')).toBeTruthy()
  })

  it('updateOrgLead/deleteOrgLead work normally for the owning org', async () => {
    const result = await updateOrgLead('org-B', 'lead-b1', { name: 'Bobby' })
    expect(result.error).toBeUndefined()
    expect(leadsData.find((l) => l.id === 'lead-b1')?.name).toBe('Bobby')

    await deleteOrgLead('org-B', 'lead-b1')
    expect(leadsData.find((l) => l.id === 'lead-b1')).toBeUndefined()
  })
})

describe('computeOrgAnalytics: org isolation', () => {
  it('only counts coach_clients belonging to coaches in the requested org', async () => {
    vi.resetModules()
    vi.doMock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          const fixtures: Record<string, Record<string, unknown>[]> = {
            org_members: [
              { user_id: 'coach-a', org_id: 'org-A', is_active: true },
              { user_id: 'coach-b', org_id: 'org-B', is_active: true },
            ],
            coach_clients: [
              { coach_id: 'coach-a', client_id: 'client-1', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
              { coach_id: 'coach-b', client_id: 'client-2', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
              { coach_id: 'coach-b', client_id: 'client-3', accepted_at: '2026-01-01', archived_at: null, status: 'active' },
            ],
            profiles: [
              { id: 'coach-a', full_name: 'Coach A', email: 'a@x.com' },
              { id: 'coach-b', full_name: 'Coach B', email: 'b@x.com' },
            ],
          }
          let rows = [...(fixtures[table] ?? [])]
          const builder = {
            select: () => builder,
            eq: (col: string, val: unknown) => { rows = rows.filter((r) => r[col] === val); return builder },
            in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes(r[col])); return builder },
            then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: rows, error: null }),
          }
          return builder
        },
      }),
    }))

    const { computeOrgAnalytics: compute } = await import('@/lib/org')
    const orgA = await compute('org-A')
    const orgB = await compute('org-B')

    expect(orgA.total_active).toBe(1)
    expect(orgB.total_active).toBe(2)
    expect(orgA.clients_by_coach).toEqual([{ name: 'Coach A', count: 1 }])
  })
})
