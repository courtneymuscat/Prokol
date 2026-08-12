import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { ensureClientOnlyTemplate } from '@/lib/autoflow-fork'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; flowId: string }> }

// POST /api/coach/clients/[clientId]/autoflows/[flowId]/duplicate-step
// Body: { step_number: number }
//
// Duplicates the step identified by step_number, inserting a copy immediately
// after it. Steps that follow are renumbered (+1) and their day_offsets
// advanced by +7 to keep the weekly cadence intact. If the flow is still
// pointing at a shared template, the template is first forked into a private
// clone tied to this client only.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { clientId, flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { step_number?: number }
  const stepNumber = body.step_number
  if (typeof stepNumber !== 'number') {
    return Response.json({ error: 'step_number required' }, { status: 400 })
  }

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

  const { data: allSteps } = await admin
    .from('autoflow_template_steps')
    .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, form_save_to_file, tasks, automated_message')
    .eq('template_id', fork.template_id)
    .order('step_number')

  if (!allSteps || allSteps.length === 0) {
    return Response.json({ error: 'Template has no steps' }, { status: 404 })
  }

  // Find the source step to copy.
  const sourceIdx = allSteps.findIndex(s => s.step_number === stepNumber)
  const source = sourceIdx !== -1 ? allSteps[sourceIdx] : allSteps[allSteps.length - 1]
  const insertAfterNum = source.step_number as number
  const newDayOffset = (source.day_offset as number ?? 0) + 7

  // Steps that come after the source need their step_number and day_offset
  // bumped to make room for the new step.
  const stepsAfter = allSteps.filter(s => (s.step_number as number) > insertAfterNum)

  if (stepsAfter.length > 0) {
    // Delete the rows that need renumbering, then re-insert with +1 step_number
    // and +7 day_offset. Doing this as delete+reinsert avoids unique-constraint
    // issues that would arise from in-place updates.
    await admin.from('autoflow_template_steps').delete()
      .eq('template_id', fork.template_id)
      .in('step_number', stepsAfter.map(s => s.step_number))

    await admin.from('autoflow_template_steps').insert(
      stepsAfter.map(s => ({
        template_id: fork.template_id,
        ...s,
        step_number: (s.step_number as number) + 1,
        day_offset: (s.day_offset as number ?? 0) + 7,
      }))
    )
  }

  // Insert the new step immediately after the source.
  const newStepNumber = insertAfterNum + 1

  const newQuestions = Array.isArray(source.questions)
    ? (source.questions as Array<Record<string, unknown>>).map((q) => ({ ...q, id: crypto.randomUUID() }))
    : []
  const newTasks = Array.isArray(source.tasks)
    ? (source.tasks as Array<Record<string, unknown>>).map((t) => ({ ...t, id: crypto.randomUUID() }))
    : []

  const { error: insertErr } = await admin
    .from('autoflow_template_steps')
    .insert({
      template_id: fork.template_id,
      step_number: newStepNumber,
      title: source.title ?? `Step ${newStepNumber}`,
      description: source.description ?? null,
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
