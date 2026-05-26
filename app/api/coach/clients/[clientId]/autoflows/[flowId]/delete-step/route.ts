import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { ensureClientOnlyTemplate } from '@/lib/autoflow-fork'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; flowId: string }> }

// POST /api/coach/clients/[clientId]/autoflows/[flowId]/delete-step
// Body: { step_number: number }
//
// Removes a step from this client's autoflow. If the flow is still
// pointing at a shared template, the template is first forked into a
// private clone (see lib/autoflow-fork). After the fork the deletion
// only affects this client — every other client on the original
// template keeps the step.
//
// Cleanup performed against the (now private) template:
//   - autoflow_template_steps row deleted
//   - this client's overrides + responses + calendar events for the
//     deleted step are removed too (so we don't leak orphaned data)
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

  await Promise.all([
    admin
      .from('autoflow_template_steps')
      .delete()
      .eq('template_id', fork.template_id)
      .eq('step_number', stepNumber),
    admin
      .from('client_autoflow_step_overrides')
      .delete()
      .eq('client_autoflow_id', flowId)
      .eq('step_number', stepNumber),
    admin
      .from('autoflow_responses')
      .delete()
      .eq('client_autoflow_id', flowId)
      .eq('step_number', stepNumber),
    admin
      .from('calendar_events')
      .delete()
      .eq('type', 'autoflow')
      .filter('content->>flow_id', 'eq', flowId)
      .filter('content->>step_number', 'eq', String(stepNumber)),
  ])

  // Keep total_steps in sync.
  const { count } = await admin
    .from('autoflow_template_steps')
    .select('step_number', { count: 'exact', head: true })
    .eq('template_id', fork.template_id)
  await admin
    .from('autoflow_templates')
    .update({ total_steps: count ?? 0 })
    .eq('id', fork.template_id)

  return Response.json({ ok: true, was_forked: fork.was_forked })
}
