import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Exercises the actual bulk-review route handler (not just computeCheckinFlags
// in isolation, already covered in checkin-flags.test.ts) — specifically the
// "flagged rows need confirmFlagged, unflagged ones don't" gate, and that
// clearing a flag never deletes it (reason stays in history).
let data: Record<string, unknown[]> = {}
const updateCalls: { table: string; patch: Record<string, unknown> }[] = []

function makeClient() {
  return {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        is: () => builder,
        update(patch: Record<string, unknown>) {
          updateCalls.push({ table, patch })
          return builder
        },
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: data[table] ?? [], error: null }),
      }
      return builder
    },
  }
}

vi.mock('@/lib/coach', () => ({
  requireCoach: async () => 'coach-1',
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeClient(),
}))

const { POST } = await import('@/app/api/coach/checkins/prokol-method/bulk-review/route')

function req(body: unknown) {
  return new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  updateCalls.length = 0
  data = {}
})

describe('bulk-review: unflagged responses', () => {
  it('reviews unflagged responses immediately, no confirm needed', async () => {
    data.autoflow_responses = [{ id: 'r1' }]
    data.autoflow_response_flags = [] // no open flags for r1

    const res = await POST(req({ responseIds: ['r1'] }))
    const body = await res.json()

    expect(body.reviewed).toEqual(['r1'])
    expect(body.skippedFlagged).toEqual([])
    const reviewUpdate = updateCalls.find((c) => c.table === 'autoflow_responses')
    expect(reviewUpdate?.patch.reviewed_by_coach).toBe(true)
  })
})

describe('bulk-review: flagged responses', () => {
  it('skips a flagged response without confirmFlagged — does not mark it reviewed', async () => {
    data.autoflow_responses = [{ id: 'r1' }]
    data.autoflow_response_flags = [{ response_id: 'r1' }]

    const res = await POST(req({ responseIds: ['r1'] }))
    const body = await res.json()

    expect(body.reviewed).toEqual([])
    expect(body.skippedFlagged).toEqual(['r1'])
    expect(updateCalls.find((c) => c.table === 'autoflow_responses')).toBeUndefined()
  })

  it('reviews AND clears the flag when confirmFlagged is true', async () => {
    data.autoflow_responses = [{ id: 'r1' }]
    data.autoflow_response_flags = [{ response_id: 'r1' }]

    const res = await POST(req({ responseIds: ['r1'], confirmFlagged: true }))
    const body = await res.json()

    expect(body.reviewed).toEqual(['r1'])
    expect(body.skippedFlagged).toEqual([])

    const reviewUpdate = updateCalls.find((c) => c.table === 'autoflow_responses')
    expect(reviewUpdate?.patch.reviewed_by_coach).toBe(true)

    const clearUpdate = updateCalls.find((c) => c.table === 'autoflow_response_flags')
    expect(clearUpdate?.patch.cleared_at).toBeTruthy()
    expect(clearUpdate?.patch.cleared_by).toBe('coach-1')
    // Clearing never deletes — the flag row (with its original reason) stays,
    // just stamped with cleared_at/cleared_by. No delete call to this table.
    expect(updateCalls.every((c) => c.table !== 'autoflow_response_flags' || 'cleared_at' in c.patch)).toBe(true)
  })

  it('a mixed batch reviews the unflagged ones and skips only the flagged one', async () => {
    data.autoflow_responses = [{ id: 'r1' }, { id: 'r2' }]
    data.autoflow_response_flags = [{ response_id: 'r2' }] // only r2 is flagged

    const res = await POST(req({ responseIds: ['r1', 'r2'] }))
    const body = await res.json()

    expect(body.reviewed).toEqual(['r1'])
    expect(body.skippedFlagged).toEqual(['r2'])
  })
})

describe('bulk-review: missed check-in rows (no underlying response)', () => {
  it('skips a missed-checkin flag without confirmFlagged', async () => {
    const res = await POST(req({ responseIds: ['missed-f1'] }))
    const body = await res.json()
    expect(body.skippedFlagged).toEqual(['missed-f1'])
    expect(body.reviewed).toEqual([])
  })

  it('clears a missed-checkin flag when confirmFlagged is true', async () => {
    data.autoflow_response_flags = [{ id: 'f1' }]

    const res = await POST(req({ responseIds: ['missed-f1'], confirmFlagged: true }))
    const body = await res.json()

    expect(body.reviewed).toEqual(['missed-f1'])
    const clearUpdate = updateCalls.find((c) => c.table === 'autoflow_response_flags')
    expect(clearUpdate?.patch.cleared_at).toBeTruthy()
  })
})

describe('bulk-review: input validation', () => {
  it('rejects an empty responseIds array', async () => {
    const res = await POST(req({ responseIds: [] }))
    expect(res.status).toBe(400)
  })

  it('rejects a missing responseIds field', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })
})
