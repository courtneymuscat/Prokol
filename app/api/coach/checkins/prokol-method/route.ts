import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { PROKOL_METHOD_CHECKIN_TEMPLATE_ID } from '@/lib/prokolMethodIds'

// Enriched list of Prokol Method check-in responses for this coach's
// clients — powers the bulk-review tab. Bounded to the last 500 so a
// long-running coaching business doesn't load an unbounded feed; this
// still comfortably covers months of weekly check-ins for a normal client
// roster and the UI filters/sorts client-side from there.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: flows } = await admin
    .from('client_autoflows')
    .select('id, client_id, selected_path, start_date')
    .eq('coach_id', coachId)
    .eq('template_id', PROKOL_METHOD_CHECKIN_TEMPLATE_ID)

  if (!flows?.length) return Response.json([])

  const flowIds = flows.map((f) => f.id)
  const flowById = Object.fromEntries(flows.map((f) => [f.id, f]))

  const [{ data: steps }, { data: responses }, { data: profiles }] = await Promise.all([
    admin
      .from('autoflow_template_steps')
      .select('step_number, title')
      .eq('template_id', PROKOL_METHOD_CHECKIN_TEMPLATE_ID),
    admin
      .from('autoflow_responses')
      .select('id, client_autoflow_id, step_number, client_id, answers, submitted_at, reviewed_by_coach, reviewed_at, coach_feedback')
      .in('client_autoflow_id', flowIds)
      .order('submitted_at', { ascending: false })
      .limit(500),
    admin
      .from('profiles')
      .select('id, full_name, first_name, email')
      .in('id', flows.map((f) => f.client_id)),
  ])

  const stepMeta = Object.fromEntries((steps ?? []).map((s) => [s.step_number, s.title as string]))
  const profileById = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, (p.full_name as string | null) ?? (p.first_name as string | null) ?? p.email]),
  )

  const responseIds = (responses ?? []).map((r) => r.id)
  const { data: flags } = responseIds.length
    ? await admin
        .from('autoflow_response_flags')
        .select('response_id, rule_key, severity, reason, created_at, cleared_at')
        .in('response_id', responseIds)
    : { data: [] as never[] }

  const flagsByResponse: Record<string, { rule_key: string; severity: string; reason: string; cleared_at: string | null }[]> = {}
  for (const f of flags ?? []) {
    const rid = f.response_id as string
    ;(flagsByResponse[rid] ??= []).push({ rule_key: f.rule_key, severity: f.severity, reason: f.reason, cleared_at: f.cleared_at })
  }

  function stepType(title: string): 'week0' | 'final' | 'weekly' {
    if (title === 'Week 0 Check-in') return 'week0'
    if (title === 'Final Check-in') return 'final'
    return 'weekly'
  }

  const rows = (responses ?? []).map((r) => {
    const flow = flowById[r.client_autoflow_id]
    const title = stepMeta[r.step_number] ?? `Step ${r.step_number}`
    const answers = (r.answers ?? {}) as Record<string, string>
    const openFlags = (flagsByResponse[r.id] ?? []).filter((f) => !f.cleared_at)
    return {
      id: r.id,
      client_id: r.client_id,
      client_name: profileById[r.client_id] ?? 'Unknown',
      flow_id: r.client_autoflow_id,
      step_number: r.step_number,
      title,
      type: stepType(title),
      path: flow?.selected_path ?? null,
      submitted_at: r.submitted_at,
      overall_score: answers.overall_1_10 ?? null,
      reviewed: r.reviewed_by_coach ?? false,
      reviewed_at: r.reviewed_at,
      has_feedback: !!r.coach_feedback,
      flags: flagsByResponse[r.id] ?? [],
      is_flagged: openFlags.length > 0,
      flag_severity: openFlags.some((f) => f.severity === 'urgent') ? 'urgent' : openFlags.some((f) => f.severity === 'lead') ? 'lead' : openFlags.length > 0 ? 'normal' : null,
    }
  })

  // Also surface any missed-check-in flags (no response row to attach to)
  const { data: missedFlags } = await admin
    .from('autoflow_response_flags')
    .select('id, client_autoflow_id, step_number, client_id, reason, created_at, cleared_at')
    .in('client_autoflow_id', flowIds)
    .is('response_id', null)
    .is('cleared_at', null)

  const missedRows = (missedFlags ?? []).map((f) => ({
    id: `missed-${f.id}`,
    flag_id: f.id,
    client_id: f.client_id,
    client_name: profileById[f.client_id] ?? 'Unknown',
    flow_id: f.client_autoflow_id,
    step_number: f.step_number,
    title: stepMeta[f.step_number] ?? `Step ${f.step_number}`,
    type: 'missed' as const,
    path: flowById[f.client_autoflow_id]?.selected_path ?? null,
    submitted_at: f.created_at,
    overall_score: null,
    reviewed: false,
    reviewed_at: null,
    has_feedback: false,
    flags: [{ rule_key: 'missed_checkin_two_weeks', severity: 'normal', reason: f.reason, cleared_at: null }],
    is_flagged: true,
    flag_severity: 'normal' as const,
  }))

  return Response.json([...rows, ...missedRows])
}
