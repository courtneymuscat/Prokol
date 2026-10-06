import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Same builder style as org-leads-analytics-scoping.test.ts, but exercising
// is('org_id', null) instead of eq('org_id', orgId) — this is Court's own
// platform-growth CRM and must never surface (or let her mutate) another
// organisation's leads.
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
      rows = rows.filter((r) => (val === null ? r[col] == null : r[col] === val))
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

vi.mock('@/lib/admin', () => ({
  requirePlatformAdmin: async () => ({ id: 'admin-1', org_id: 'court-org' }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'admin-1' } } } }) },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'leads') return makeLeadsBuilder(leadsData)
      throw new Error(`unexpected table: ${table}`)
    },
  }),
}))

const { GET, POST } = await import('@/app/api/admin/leads/route')
const { PATCH, DELETE } = await import('@/app/api/admin/leads/[id]/route')

function fakeRequest(body?: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  leadsData = [
    { id: 'court-lead-1', org_id: null, name: 'Gym Prospect', created_at: '2026-01-01' },
    { id: 'org-lead-1', org_id: 'some-org', name: "Some Org's Client Lead", created_at: '2026-01-01' },
  ]
})

describe('GET /api/admin/leads', () => {
  it('only returns org_id IS NULL leads, never another org\'s', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.leads.map((l: { id: string }) => l.id)).toEqual(['court-lead-1'])
  })
})

describe('POST /api/admin/leads', () => {
  it('always inserts with org_id null, even if told otherwise', async () => {
    const res = await POST(fakeRequest({ name: 'New Gym Lead', org_id: 'some-org' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.lead.org_id).toBeNull()
  })
})

describe('PATCH/DELETE /api/admin/leads/[id]', () => {
  it('cannot update a lead belonging to an organisation', async () => {
    const res = await PATCH(fakeRequest({ name: 'Hacked' }), { params: Promise.resolve({ id: 'org-lead-1' }) })
    expect(res.status).toBe(500)
    expect(leadsData.find((l) => l.id === 'org-lead-1')?.name).toBe("Some Org's Client Lead")
  })

  it('cannot delete a lead belonging to an organisation', async () => {
    await DELETE(fakeRequest(), { params: Promise.resolve({ id: 'org-lead-1' }) })
    expect(leadsData.find((l) => l.id === 'org-lead-1')).toBeTruthy()
  })

  it('can update its own (org_id null) lead normally', async () => {
    const res = await PATCH(fakeRequest({ name: 'Renamed Gym Prospect' }), { params: Promise.resolve({ id: 'court-lead-1' }) })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.lead.name).toBe('Renamed Gym Prospect')
  })
})
