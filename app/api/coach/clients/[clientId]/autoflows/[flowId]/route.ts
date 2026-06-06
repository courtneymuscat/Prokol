import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; flowId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id, name, start_date, status, template_id, core_questions, autoflow_templates(type, total_steps, core_questions)')
    .eq('id', flowId)
    .eq('coach_id', coachId)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  // Effective core questions: the flow-level override wins over the
  // template default. The frontend treats this as a single source of
  // truth so it doesn't have to coalesce.
  const tplCore = (flow.autoflow_templates as { core_questions?: unknown[] } | null)?.core_questions ?? []
  const effectiveCoreQuestions = Array.isArray((flow as { core_questions?: unknown[] }).core_questions)
    ? (flow as { core_questions: unknown[] }).core_questions
    : tplCore
  const hasCoreOverride = Array.isArray((flow as { core_questions?: unknown[] }).core_questions)

  const [{ data: steps }, { data: overrides }, { data: responses }, { data: dismissals }] = await Promise.all([
    supabase
      .from('autoflow_template_steps')
      .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, tasks, resource_ids, form_id')
      .eq('template_id', flow.template_id)
      .order('step_number'),
    supabase
      .from('client_autoflow_step_overrides')
      .select('step_number, title, description, questions, due_date')
      .eq('client_autoflow_id', flowId),
    supabase
      .from('autoflow_responses')
      .select('step_number, answers, submitted_at')
      .eq('client_autoflow_id', flowId)
      .order('step_number'),
    supabase
      .from('autoflow_step_dismissals')
      .select('step_number, snooze_until')
      .eq('client_autoflow_id', flowId)
      .gt('snooze_until', new Date().toISOString()),
  ])

  const overrideMap: Record<number, { title?: string | null; description?: string | null; questions?: unknown[]; due_date?: string | null }> = Object.fromEntries(
    (overrides ?? []).map(o => [o.step_number, { title: o.title ?? null, description: o.description ?? null, questions: o.questions, due_date: o.due_date ?? null }])
  )
  const responseMap: Record<number, { submitted_at: string; answers: unknown }> = Object.fromEntries(
    (responses ?? []).map(r => [r.step_number, { submitted_at: r.submitted_at, answers: r.answers }])
  )
  // Keep only the latest snooze per step in case the client dismissed twice
  const dismissalMap: Record<number, string> = {}
  for (const d of dismissals ?? []) {
    const existing = dismissalMap[d.step_number]
    if (!existing || new Date(d.snooze_until) > new Date(existing)) {
      dismissalMap[d.step_number] = d.snooze_until
    }
  }

  // Resolve all resource IDs across all steps in one query
  const allResourceIds = (steps ?? []).flatMap(s =>
    Array.isArray((s as Record<string, unknown>).resource_ids) ? (s as Record<string, unknown>).resource_ids as string[] : []
  )
  const allFormIds = (steps ?? [])
    .map(s => (s as Record<string, unknown>).form_id as string | null)
    .filter(Boolean) as string[]

  const [resourcesResult, formsResult] = await Promise.all([
    allResourceIds.length > 0
      ? supabase.from('coach_resources').select('id, name, type, url').in('id', allResourceIds)
      : Promise.resolve({ data: [] }),
    allFormIds.length > 0
      ? supabase.from('forms').select('id, title').in('id', allFormIds)
      : Promise.resolve({ data: [] }),
  ])

  const resourceMap: Record<string, { id: string; name: string; type: string; url: string | null }> = Object.fromEntries(
    (resourcesResult.data ?? []).map((r: { id: string; name: string; type: string; url: string | null }) => [r.id, r])
  )
  const formMap: Record<string, { id: string; title: string }> = Object.fromEntries(
    (formsResult.data ?? []).map((f: { id: string; title: string }) => [f.id, f])
  )

  const enrichedSteps = (steps ?? []).map(s => {
    const ov = overrideMap[s.step_number]
    const stepRecord = s as Record<string, unknown>
    const resourceIds = Array.isArray(stepRecord.resource_ids) ? stepRecord.resource_ids as string[] : []
    const formId = stepRecord.form_id as string | null
    return {
      ...s,
      title: ov?.title ?? s.title,
      description: ov?.description ?? s.description,
      questions: ov?.questions ?? s.questions,
      has_override: !!(ov?.questions || ov?.title || ov?.description),
      due_date_override: ov?.due_date ?? null,
      response: responseMap[s.step_number] ?? null,
      tasks: (stepRecord.tasks as unknown[]) ?? [],
      resources: resourceIds.map(id => resourceMap[id]).filter(Boolean),
      linked_form: formId ? (formMap[formId] ?? null) : null,
      snoozed_until: dismissalMap[s.step_number] ?? null,
    }
  })

  return Response.json({
    ...flow,
    // Expose the resolved core_questions at the top level so the UI can
    // show a single editable list, plus a flag the editor uses to decide
    // whether to label the entries as overridden.
    effective_core_questions: effectiveCoreQuestions,
    core_questions_overridden: hasCoreOverride,
    steps: enrichedSteps,
  })
}

// PUT: save client-specific question and/or due-date override for a step
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { clientId, flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { step_number, questions, due_date, title, description, core_questions } = await req.json()
  if (!step_number) return Response.json({ error: 'step_number required' }, { status: 400 })

  const supabase = await createClient()

  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id, name, template_id')
    .eq('id', flowId)
    .eq('coach_id', coachId)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  // Build the upsert payload — only include fields that were explicitly passed
  const upsertPayload: Record<string, unknown> = { client_autoflow_id: flowId, step_number }
  if (questions !== undefined) upsertPayload.questions = questions ?? []
  if (due_date !== undefined) upsertPayload.due_date = due_date ?? null
  if (title !== undefined) upsertPayload.title = title ?? null
  if (description !== undefined) upsertPayload.description = description ?? null

  await supabase
    .from('client_autoflow_step_overrides')
    .upsert(upsertPayload, { onConflict: 'client_autoflow_id,step_number' })

  // Core questions are flow-level (applied to every step) — when the
  // coach edits them inside the per-step editor, the change propagates
  // to the parent client_autoflows row instead of the per-step override.
  if (core_questions !== undefined) {
    await supabase
      .from('client_autoflows')
      .update({ core_questions: Array.isArray(core_questions) ? core_questions : null })
      .eq('id', flowId)
      .eq('coach_id', coachId)
  }

  // Whenever the step title is touched OR the due_date changes, refresh
  // the corresponding calendar event so the coach's calendar reflects
  // the latest title. Effective title = client override ?? template
  // step title.
  if (title !== undefined || (due_date !== undefined && due_date !== null)) {
    const { data: templateStep } = await supabase
      .from('autoflow_template_steps')
      .select('title')
      .eq('template_id', flow.template_id)
      .eq('step_number', step_number)
      .single()

    // Look up any title override we just upserted (might be null).
    const { data: overrideRow } = await supabase
      .from('client_autoflow_step_overrides')
      .select('title')
      .eq('client_autoflow_id', flowId)
      .eq('step_number', step_number)
      .maybeSingle()

    const effectiveStepTitle = overrideRow?.title ?? templateStep?.title ?? ''
    const eventTitle = `${flow.name} — Step ${step_number}${effectiveStepTitle ? `: ${effectiveStepTitle}` : ''}`

    if (due_date !== undefined && due_date !== null) {
      // Date moved — recreate the event entirely on the new date.
      await supabase
        .from('calendar_events')
        .delete()
        .eq('coach_id', coachId)
        .eq('client_id', clientId)
        .eq('type', 'autoflow')
        .filter('content->>flow_id', 'eq', flowId)
        .filter('content->>step_number', 'eq', String(step_number))
      await supabase.from('calendar_events').insert({
        coach_id: coachId,
        client_id: clientId,
        event_date: due_date,
        type: 'autoflow',
        title: eventTitle,
        content: { flow_id: flowId, step_number, link: `/autoflows/${flowId}/${step_number}` },
      })
    } else {
      // Title-only change — update in place. Most steps have exactly one
      // matching event but we use update (not single) so it tolerates
      // edge cases (e.g. a duplicated row).
      await supabase
        .from('calendar_events')
        .update({ title: eventTitle })
        .eq('coach_id', coachId)
        .eq('client_id', clientId)
        .eq('type', 'autoflow')
        .filter('content->>flow_id', 'eq', flowId)
        .filter('content->>step_number', 'eq', String(step_number))
    }
  }

  return Response.json({ ok: true })
}

// PATCH: update start_date and regenerate calendar events (respects per-step due_date overrides)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { clientId, flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { start_date } = await req.json()
  if (!start_date) return Response.json({ error: 'start_date required' }, { status: 400 })

  const supabase = await createClient()

  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id, name, template_id')
    .eq('id', flowId)
    .eq('coach_id', coachId)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  await supabase
    .from('client_autoflows')
    .update({ start_date })
    .eq('id', flowId)

  // Delete old autoflow calendar events for this flow
  await supabase
    .from('calendar_events')
    .delete()
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('type', 'autoflow')
    .filter('content->>flow_id', 'eq', flowId)

  // Fetch template steps + any per-step due_date / title overrides so the
  // regenerated events reflect both the moved schedule AND any per-client
  // title customisation the coach has applied.
  const [{ data: steps }, { data: overrides }] = await Promise.all([
    supabase
      .from('autoflow_template_steps')
      .select('step_number, title, day_offset, trigger_type')
      .eq('template_id', flow.template_id)
      .order('step_number'),
    supabase
      .from('client_autoflow_step_overrides')
      .select('step_number, due_date, title')
      .eq('client_autoflow_id', flowId),
  ])

  const overrideDates: Record<number, string> = Object.fromEntries(
    (overrides ?? []).filter(o => o.due_date).map(o => [o.step_number, o.due_date])
  )
  const overrideTitles: Record<number, string> = Object.fromEntries(
    (overrides ?? []).filter(o => o.title).map(o => [o.step_number, o.title])
  )

  if (steps && steps.length > 0) {
    const [y, m, d] = start_date.split('-').map(Number)
    const events = steps
      .filter((s) => (s as Record<string, unknown>).trigger_type !== 'on_step_complete')
      .map((s) => {
        // Prefer per-step override date; fall back to start_date + day_offset (UTC-safe)
        const eventDate = overrideDates[s.step_number]
          ?? new Date(Date.UTC(y, m - 1, d + s.day_offset)).toISOString().split('T')[0]
        // Effective step title = client override ?? template's step title
        const effectiveStepTitle = overrideTitles[s.step_number] ?? s.title ?? ''
        return {
          coach_id: coachId,
          client_id: clientId,
          event_date: eventDate,
          type: 'autoflow',
          title: `${flow.name} — Step ${s.step_number}${effectiveStepTitle ? `: ${effectiveStepTitle}` : ''}`,
          content: { flow_id: flowId, step_number: s.step_number, link: `/autoflows/${flowId}/${s.step_number}` },
        }
      })
    if (events.length > 0) await supabase.from('calendar_events').insert(events)
  }

  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { clientId, flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Remove autoflow calendar events for this flow before deleting the flow
  await supabase
    .from('calendar_events')
    .delete()
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('type', 'autoflow')
    .filter('content->>flow_id', 'eq', flowId)

  await supabase
    .from('client_autoflows')
    .delete()
    .eq('id', flowId)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  return Response.json({ ok: true })
}
