import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { ensureClientOnlyTemplate } from '@/lib/autoflow-fork'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; flowId: string }> }

// POST /api/coach/clients/[clientId]/autoflows/[flowId]/duplicate-step
// Body: { step_number: number }
//
// Duplicates a step inside this client's autoflow. If the flow is still
// pointing at a shared template, the template is first forked into a
// private clone tied to this client only (see lib/autoflow-fork). All
// structural edits from this point on land on the clone — every other
// client on the original template is unaffected.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { clientId, flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { step_number?: number }
  const stepNumber = body.step_number
  if (typeof stepNumber !== 'number') {
    return Response.json({ error: 'step_number required' }, { status: 400 })
  }

  // Confirm coach owns the flow before we do any work.
  const supabase = await createClient()
  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id')
    .eq('id', flowId)
    .eq('coach_id', coachId)
    .single()
  if (!flow) return Response.json({ error: 'Flow not found' }, { status: 404 })

  const admin = createAdminClient()

  // Fork-on-first-structural-edit. After this returns, template_id
  // points at a private clone (unless it already was one).
  const fork = await ensureClientOnlyTemplate(admin, { coachId, clientId, flowId })
  if ('error' in fork) return Response.json({ error: fork.error }, { status: 500 })

  // Pull the source step from the (now private) template and append a
  // copy with the next free step_number.
  const { data: allSteps } = await admin
    .from('autoflow_template_steps')
    .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, form_save_to_file, tasks, automated_message')
    .eq('template_id', fork.template_id)
    .order('step_number')
  if (!allSteps || allSteps.length === 0) {
    return Response.json({ error: 'Template has no steps' }, { status: 404 })
  }
  const source = allSteps.find((s) => s.step_number === stepNumber)
  if (!source) return Response.json({ error: 'Source step not found' }, { status: 404 })

  const nextNum = Math.max(...allSteps.map((s) => s.step_number as number)) + 1
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
      step_number: nextNum,
      title: source.title ? `${source.title} (copy)` : `Step ${nextNum}`,
      description: source.description ?? null,
      questions: newQuestions,
      day_offset: (source as Record<string, unknown>).day_offset ?? 0,
      trigger_type: (source as Record<string, unknown>).trigger_type ?? 'day_offset',
      trigger_step_number: source.trigger_step_number === stepNumber
        ? null
        : (source.trigger_step_number ?? null),
      resource_ids: source.resource_ids ?? [],
      form_id: source.form_id ?? null,
      form_save_to_file: (source as Record<string, unknown>).form_save_to_file ?? false,
      tasks: newTasks,
      automated_message: (source as Record<string, unknown>).automated_message ?? null,
    })
  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

  // Keep total_steps in sync on the private template.
  await admin
    .from('autoflow_templates')
    .update({ total_steps: allSteps.length + 1 })
    .eq('id', fork.template_id)

  return Response.json({ ok: true, new_step_number: nextNum, was_forked: fork.was_forked })
}
