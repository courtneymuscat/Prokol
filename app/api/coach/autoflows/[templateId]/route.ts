import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ templateId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { templateId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const [{ data: template }, { data: steps }] = await Promise.all([
    supabase
      .from('autoflow_templates')
      .select('id, name, description, type, total_steps, core_questions')
      .eq('id', templateId)
      .eq('coach_id', coachId)
      .single(),
    supabase
      .from('autoflow_template_steps')
      .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, form_save_to_file, tasks, automated_message')
      .eq('template_id', templateId)
      .order('step_number'),
  ])

  if (!template) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ...template, steps: steps ?? [] })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { templateId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, core_questions, steps, push_to_clients } = await req.json()
  const supabase = await createClient()

  const { data: tpl } = await supabase
    .from('autoflow_templates')
    .select('id')
    .eq('id', templateId)
    .eq('coach_id', coachId)
    .single()
  if (!tpl) return Response.json({ error: 'Not found' }, { status: 404 })

  const totalSteps = Array.isArray(steps) ? steps.length : undefined

  await supabase
    .from('autoflow_templates')
    .update({
      name,
      description: description ?? null,
      core_questions: core_questions ?? [],
      ...(totalSteps !== undefined ? { total_steps: totalSteps } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)

  if (Array.isArray(steps)) {
    const stepRows = steps.map((s: { step_number: number; title: string; description?: string; questions: unknown[]; day_offset: number; trigger_type?: string; trigger_step_number?: number | null; resource_ids?: unknown[]; form_id?: string | null; form_save_to_file?: boolean; tasks?: unknown[]; automated_message?: string }) => ({
      template_id: templateId,
      step_number: s.step_number,
      title: s.title ?? '',
      description: s.description ?? null,
      questions: s.questions ?? [],
      day_offset: s.day_offset ?? 0,
      trigger_type: s.trigger_type ?? 'day_offset',
      trigger_step_number: s.trigger_step_number ?? null,
      resource_ids: s.resource_ids ?? [],
      form_id: s.form_id ?? null,
      form_save_to_file: s.form_save_to_file ?? false,
      tasks: s.tasks ?? [],
      automated_message: s.automated_message ?? null,
    }))
    await supabase
      .from('autoflow_template_steps')
      .upsert(stepRows, { onConflict: 'template_id,step_number' })

    // Delete any steps that were removed from the template
    const keptStepNumbers = steps.map((s: { step_number: number }) => s.step_number)
    await supabase
      .from('autoflow_template_steps')
      .delete()
      .eq('template_id', templateId)
      .not('step_number', 'in', `(${keptStepNumbers.join(',')})`)
  }

  // Push name + regenerate calendar events for active client flows
  if (push_to_clients) {
    // Update flow names
    await supabase
      .from('client_autoflows')
      .update({ name })
      .eq('template_id', templateId)
      .eq('coach_id', coachId)
      .eq('status', 'active')

    // Regenerate calendar events for each active flow based on updated step titles/offsets
    if (Array.isArray(steps)) {
      const { data: activeFlows } = await supabase
        .from('client_autoflows')
        .select('id, client_id, start_date')
        .eq('template_id', templateId)
        .eq('coach_id', coachId)
        .eq('status', 'active')

      if (activeFlows && activeFlows.length > 0) {
        for (const flow of activeFlows) {
          // Fetch per-step due_date overrides for this client flow
          const { data: overrides } = await supabase
            .from('client_autoflow_step_overrides')
            .select('step_number, due_date')
            .eq('client_autoflow_id', flow.id)

          const overrideDates: Record<number, string> = Object.fromEntries(
            (overrides ?? []).filter(o => o.due_date).map(o => [o.step_number, o.due_date])
          )

          // Delete old autoflow calendar events for this flow
          await supabase
            .from('calendar_events')
            .delete()
            .eq('coach_id', coachId)
            .eq('client_id', flow.client_id)
            .eq('type', 'autoflow')
            .filter('content->>flow_id', 'eq', flow.id)

          // Recreate with updated titles and offsets (skip on_step_complete triggered steps)
          const [y, m, d] = (flow.start_date as string).split('-').map(Number)
          const events = (steps as Array<{ step_number: number; title?: string; day_offset: number; trigger_type?: string }>)
            .filter((s) => s.trigger_type !== 'on_step_complete')
            .map((s) => ({
              coach_id: coachId,
              client_id: flow.client_id,
              event_date: overrideDates[s.step_number]
                ?? new Date(Date.UTC(y, m - 1, d + s.day_offset)).toISOString().split('T')[0],
              type: 'autoflow',
              title: `${name} — Step ${s.step_number}${s.title ? `: ${s.title}` : ''}`,
              content: { flow_id: flow.id, step_number: s.step_number, link: `/autoflows/${flow.id}/${s.step_number}` },
            }))
          if (events.length > 0) await supabase.from('calendar_events').insert(events)
        }
      }
    }
  }

  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { templateId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  await supabase
    .from('autoflow_templates')
    .delete()
    .eq('id', templateId)
    .eq('coach_id', coachId)

  return Response.json({ ok: true })
}
