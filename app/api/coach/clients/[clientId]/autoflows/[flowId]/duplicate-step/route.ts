import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { ensureClientOnlyTemplate } from '@/lib/autoflow-fork'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; flowId: string }> }

// POST /api/coach/clients/[clientId]/autoflows/[flowId]/duplicate-step
// Body: { step_number: number, source_day_offset?: number }
//
// Duplicates the step identified by step_number, inserting a copy immediately
// after it. Steps that follow are renumbered (+1) and their day_offsets
// advanced by +7. The copy uses the effective content (override title/questions
// if the coach customised the step) so the copy reflects what the coach sees,
// not the raw template data. Overrides for subsequent steps are also renumbered.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { clientId, flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { step_number?: number; source_day_offset?: number }
  const stepNumber = body.step_number
  if (typeof stepNumber !== 'number') {
    return Response.json({ error: 'step_number required' }, { status: 400 })
  }
  const clientDayOffset = typeof body.source_day_offset === 'number' ? body.source_day_offset : null

  const supabase = await createClient()
  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id')
    .eq('id', flowId)
    .eq('coach_id', coachId)
    .single()
  if (!flow) return Response.json({ error: 'Flow not found' }, { status: 404 })

  const admin = createAdminClient()

  const fork = await ensureClientOnlyTemplate(admin, { coachId, clientId, flowId })
  if ('error' in fork) return Response.json({ error: fork.error }, { status: 500 })

  const [{ data: allSteps }, { data: allOverrides }] = await Promise.all([
    admin
      .from('autoflow_template_steps')
      .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, form_save_to_file, tasks, automated_message')
      .eq('template_id', fork.template_id)
      .order('step_number'),
    admin
      .from('client_autoflow_step_overrides')
      .select('step_number, title, description, questions, due_date')
      .eq('client_autoflow_id', flowId),
  ])

  if (!allSteps || allSteps.length === 0) {
    return Response.json({ error: 'Template has no steps' }, { status: 404 })
  }

  // Find the source step (loose equality guards against DB type variance).
  const sourceIdx = allSteps.findIndex(s => Number(s.step_number) === Number(stepNumber))
  const source = sourceIdx !== -1 ? allSteps[sourceIdx] : allSteps[allSteps.length - 1]
  const insertAfterNum = Number(source.step_number)

  // Check for a client-specific override on the source step. If one exists,
  // use its title/description/questions so the copy reflects what the coach
  // sees (not the stale template data underneath the override).
  const sourceOverride = (allOverrides ?? []).find(o => Number(o.step_number) === insertAfterNum) ?? null
  const effectiveTitle = ((sourceOverride?.title ?? source.title ?? `Step ${insertAfterNum + 1}`) + ' (copy)') as string
  const effectiveDescription = (sourceOverride?.description ?? source.description ?? null) as string | null
  const effectiveQuestionsRaw = (sourceOverride?.questions ?? source.questions) as Array<Record<string, unknown>> | null

  const baseDayOffset = clientDayOffset ?? (source.day_offset as number ?? 0)
  const newDayOffset = baseDayOffset + 7
  const newStepNumber = insertAfterNum + 1

  // Steps after the source need their step_number (+1) and day_offset (+7) bumped.
  const stepsAfter = allSteps.filter(s => Number(s.step_number) > insertAfterNum)
  const overridesAfter = (allOverrides ?? []).filter(o => Number(o.step_number) > insertAfterNum)

  if (stepsAfter.length > 0) {
    await admin.from('autoflow_template_steps').delete()
      .eq('template_id', fork.template_id)
      .in('step_number', stepsAfter.map(s => s.step_number))

    await admin.from('autoflow_template_steps').insert(
      stepsAfter.map(s => ({
        template_id: fork.template_id,
        ...s,
        step_number: Number(s.step_number) + 1,
        day_offset: (s.day_offset as number ?? 0) + 7,
      }))
    )
  }

  // Also renumber overrides for subsequent steps so they stay in sync.
  if (overridesAfter.length > 0) {
    await admin.from('client_autoflow_step_overrides').delete()
      .eq('client_autoflow_id', flowId)
      .in('step_number', overridesAfter.map(o => o.step_number))

    await admin.from('client_autoflow_step_overrides').insert(
      overridesAfter.map(o => ({
        client_autoflow_id: flowId,
        step_number: Number(o.step_number) + 1,
        title: o.title ?? null,
        description: o.description ?? null,
        questions: o.questions ?? null,
        due_date: o.due_date ?? null,
      }))
    )
  }

  // Insert the new step with the effective (override-aware) content.
  const newQuestions = Array.isArray(effectiveQuestionsRaw)
    ? effectiveQuestionsRaw.map((q) => ({ ...q, id: crypto.randomUUID() }))
    : []
  const newTasks = Array.isArray(source.tasks)
    ? (source.tasks as Array<Record<string, unknown>>).map((t) => ({ ...t, id: crypto.randomUUID() }))
    : []

  const { error: insertErr } = await admin
    .from('autoflow_template_steps')
    .insert({
      template_id: fork.template_id,
      step_number: newStepNumber,
      title: effectiveTitle,
      description: effectiveDescription,
      questions: newQuestions,
      day_offset: newDayOffset,
      trigger_type: 'day_offset',
      trigger_step_number: null,
      resource_ids: source.resource_ids ?? [],
      form_id: source.form_id ?? null,
      form_save_to_file: (source as Record<string, unknown>).form_save_to_file ?? false,
      tasks: newTasks,
      automated_message: (source as Record<string, unknown>).automated_message ?? null,
    })
  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

  await admin
    .from('autoflow_templates')
    .update({ total_steps: allSteps.length + 1 })
    .eq('id', fork.template_id)

  return Response.json({ ok: true, new_step_number: newStepNumber, was_forked: fork.was_forked })
}
