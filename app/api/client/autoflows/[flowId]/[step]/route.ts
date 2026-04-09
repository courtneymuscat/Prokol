import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ flowId: string; step: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { flowId, step } = await params
  const stepNum = parseInt(step)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id, name, template_id, start_date, autoflow_templates(core_questions, total_steps, type)')
    .eq('id', flowId)
    .eq('client_id', user.id)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  const [{ data: templateStep }, { data: override }, { data: existing }] = await Promise.all([
    supabase
      .from('autoflow_template_steps')
      .select('title, description, questions, day_offset')
      .eq('template_id', flow.template_id)
      .eq('step_number', stepNum)
      .single(),
    supabase
      .from('client_autoflow_step_overrides')
      .select('questions')
      .eq('client_autoflow_id', flowId)
      .eq('step_number', stepNum)
      .maybeSingle(),
    supabase
      .from('autoflow_responses')
      .select('id, answers, submitted_at')
      .eq('client_autoflow_id', flowId)
      .eq('step_number', stepNum)
      .maybeSingle(),
  ])

  const tpl = flow.autoflow_templates as { core_questions: unknown[]; total_steps: number; type: string } | null

  return Response.json({
    flow_id: flowId,
    flow_name: flow.name,
    step_number: stepNum,
    total_steps: tpl?.total_steps ?? 1,
    type: tpl?.type ?? 'weekly_checkin',
    title: templateStep?.title ?? `Step ${stepNum}`,
    description: templateStep?.description ?? null,
    core_questions: tpl?.core_questions ?? [],
    questions: override?.questions ?? templateStep?.questions ?? [],
    existing_submission: existing ?? null,
  })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { flowId, step } = await params
  const stepNum = parseInt(step)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id')
    .eq('id', flowId)
    .eq('client_id', user.id)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  const { answers } = await req.json()
  const { error } = await supabase
    .from('autoflow_responses')
    .upsert(
      { client_autoflow_id: flowId, step_number: stepNum, client_id: user.id, answers, submitted_at: new Date().toISOString() },
      { onConflict: 'client_autoflow_id,step_number' }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
