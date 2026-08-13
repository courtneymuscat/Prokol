import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { ensureClientOnlyTemplate } from '@/lib/autoflow-fork'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; flowId: string }> }

// POST /api/coach/clients/[clientId]/autoflows/[flowId]/reorder-step
// Body: { step_number: number, direction: 'up' | 'down' }
//
// Swaps a step with the adjacent step (up = swap with previous, down = swap
// with next). Forks the template into a private clone on first use so other
// clients are unaffected. Also fixes any trigger_step_number references that
// point to the two swapped steps.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { clientId, flowId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { step_number?: number; direction?: string }
  const { step_number: stepNumber, direction } = body
  if (typeof stepNumber !== 'number' || (direction !== 'up' && direction !== 'down')) {
    return Response.json({ error: 'step_number and direction (up|down) required' }, { status: 400 })
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

  // Fetch all steps ordered so we can find neighbors.
  const { data: allSteps } = await admin
    .from('autoflow_template_steps')
    .select('step_number, title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, form_save_to_file, tasks, automated_message')
    .eq('template_id', fork.template_id)
    .order('step_number')

  if (!allSteps || allSteps.length < 2) {
    return Response.json({ error: 'Not enough steps to reorder' }, { status: 400 })
  }

  const idx = allSteps.findIndex(s => s.step_number === stepNumber)
  if (idx === -1) return Response.json({ error: 'Step not found' }, { status: 404 })

  const neighborIdx = direction === 'up' ? idx - 1 : idx + 1
  if (neighborIdx < 0 || neighborIdx >= allSteps.length) {
    return Response.json({ error: 'Cannot move step in that direction' }, { status: 400 })
  }

  const stepA = allSteps[idx]
  const stepB = allSteps[neighborIdx]
  const numA = stepA.step_number as number
  const numB = stepB.step_number as number

  // Delete both rows and re-insert with swapped step_numbers AND day_offsets
  // so that the due date travels with the position, not the content.
  await admin.from('autoflow_template_steps').delete()
    .eq('template_id', fork.template_id)
    .in('step_number', [numA, numB])

  const dayA = stepA.day_offset as number
  const dayB = stepB.day_offset as number

  await admin.from('autoflow_template_steps').insert([
    { template_id: fork.template_id, ...stepA, step_number: numB, day_offset: dayB },
    { template_id: fork.template_id, ...stepB, step_number: numA, day_offset: dayA },
  ])

  // Fix trigger_step_number references that pointed at either swapped step.
  await Promise.all([
    admin.from('autoflow_template_steps')
      .update({ trigger_step_number: numB })
      .eq('template_id', fork.template_id)
      .eq('trigger_step_number', numA)
      .neq('step_number', numA)
      .neq('step_number', numB),
    admin.from('autoflow_template_steps')
      .update({ trigger_step_number: numA })
      .eq('template_id', fork.template_id)
      .eq('trigger_step_number', numB)
      .neq('step_number', numA)
      .neq('step_number', numB),
  ])

  // Also swap client_autoflow_step_overrides so that the coach-edited title,
  // questions, and custom date travel with the content when steps are reordered.
  const { data: ovs } = await admin
    .from('client_autoflow_step_overrides')
    .select('step_number, title, description, questions, due_date')
    .eq('client_autoflow_id', flowId)
    .in('step_number', [numA, numB])

  const ovA = ovs?.find(o => Number(o.step_number) === numA) ?? null
  const ovB = ovs?.find(o => Number(o.step_number) === numB) ?? null

  if (ovA || ovB) {
    await admin.from('client_autoflow_step_overrides').delete()
      .eq('client_autoflow_id', flowId)
      .in('step_number', [numA, numB])

    const toInsert = []
    if (ovA) toInsert.push({ client_autoflow_id: flowId, step_number: numB, title: ovA.title ?? null, description: ovA.description ?? null, questions: ovA.questions ?? null, due_date: ovA.due_date ?? null })
    if (ovB) toInsert.push({ client_autoflow_id: flowId, step_number: numA, title: ovB.title ?? null, description: ovB.description ?? null, questions: ovB.questions ?? null, due_date: ovB.due_date ?? null })
    if (toInsert.length > 0) {
      await admin.from('client_autoflow_step_overrides').insert(toInsert)
    }
  }

  return Response.json({ ok: true, was_forked: fork.was_forked })
}
