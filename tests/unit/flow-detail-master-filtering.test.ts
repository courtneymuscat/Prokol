import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Exercises the actual route handler (not just the helper function) so the
// enrichedSteps construction logic itself — the piece that decides what a
// gym coach does/doesn't see — is under test, not just isMasterSourcedForViewer
// in isolation (already covered in master-template-ip-protection.test.ts).
let hideUnanswered = true
let data: Record<string, unknown> = {}

function makeClient() {
  return {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        in: () => builder,
        gt: () => builder,
        single: async () => ({ data: data[table] ?? null }),
        maybeSingle: async () => ({ data: data[table] ?? null }),
        then: (resolve: (v: { data: unknown; error: null }) => void) =>
          resolve({ data: (data[table] as unknown[] | undefined) ?? [], error: null }),
      }
      return builder
    },
  }
}

vi.mock('@/lib/coach', () => ({
  requireCoach: async () => 'gym-coach-user',
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => makeClient(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeClient(),
}))

vi.mock('@/lib/org', () => ({
  isMasterSourcedForViewer: async () => hideUnanswered,
}))

const { GET } = await import('@/app/api/coach/clients/[clientId]/autoflows/[flowId]/route')

function makeCtx() {
  return { params: Promise.resolve({ clientId: 'client-1', flowId: 'flow-1' }) }
}

beforeEach(() => {
  data = {
    client_autoflows: { id: 'flow-1', name: 'Kickstart', start_date: '2026-01-01', status: 'active', template_id: 'template-1', core_questions: null, autoflow_templates: { type: 'weekly_checkin', total_steps: 2, core_questions: [] } },
    autoflow_templates: { coach_id: 'court-user', org_id: 'court-org', is_org_template: false },
    autoflow_template_steps: [
      { step_number: 1, title: 'Week 1 — Foundations', description: 'intro', questions: [{ id: 'q1', type: 'text', label: 'How are you feeling?', required: true }], day_offset: 0, trigger_type: 'day_offset', trigger_step_number: null, tasks: [], resource_ids: [], form_id: null },
      { step_number: 2, title: 'Week 2 — Momentum', description: 'next', questions: [{ id: 'q2', type: 'text', label: 'Any wins this week?', required: true }], day_offset: 7, trigger_type: 'day_offset', trigger_step_number: null, tasks: [], resource_ids: [], form_id: null },
    ],
    client_autoflow_step_overrides: [],
    autoflow_responses: [
      { step_number: 1, answers: { q1: 'Great!' }, submitted_at: '2026-01-02T00:00:00Z' },
    ],
    autoflow_step_dismissals: [],
    coach_resources: [],
    forms: [],
  }
})

describe('GET flow detail — master-sourced content filtering', () => {
  it('hides title/questions for unanswered steps when the flow is master-sourced for this viewer', async () => {
    hideUnanswered = true
    const res = await GET(new NextRequest('http://localhost/x'), makeCtx())
    const body = await res.json()

    const [step1, step2] = body.steps
    // Step 1 was answered — full content should come through.
    expect(step1.title).toBe('Week 1 — Foundations')
    expect(step1.questions).toHaveLength(1)
    expect(step1.response).not.toBeNull()
    expect(step1.locked).toBe(false)

    // Step 2 has no response yet — content must be stripped.
    expect(step2.title).toBeNull()
    expect(step2.description).toBeNull()
    expect(step2.questions).toEqual([])
    expect(step2.tasks).toEqual([])
    expect(step2.locked).toBe(true)
    // Scheduling info still comes through so the UI can show a due date.
    expect(step2.day_offset).toBe(7)
  })

  it('shows full content for every step when the flow is not master-sourced (owner / same-org)', async () => {
    hideUnanswered = false
    const res = await GET(new NextRequest('http://localhost/x'), makeCtx())
    const body = await res.json()

    const [step1, step2] = body.steps
    expect(step1.title).toBe('Week 1 — Foundations')
    expect(step2.title).toBe('Week 2 — Momentum')
    expect(step2.questions).toHaveLength(1)
    expect(step2.locked).toBe(false)
  })
})
