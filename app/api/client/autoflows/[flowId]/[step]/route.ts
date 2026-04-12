import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ flowId: string; step: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { flowId, step } = await params
  const stepNum = parseInt(step)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Use admin client for coach-managed tables (RLS may block client reads)
  const admin = createAdminClient()

  const { data: flow } = await admin
    .from('client_autoflows')
    .select('id, name, template_id, start_date, coach_id, autoflow_templates(core_questions, total_steps, type)')
    .eq('id', flowId)
    .eq('client_id', user.id)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  const [{ data: templateStep }, { data: override }, { data: existing }] = await Promise.all([
    admin
      .from('autoflow_template_steps')
      .select('title, description, questions, day_offset, trigger_type, trigger_step_number, resource_ids, form_id, tasks')
      .eq('template_id', flow.template_id)
      .eq('step_number', stepNum)
      .single(),
    admin
      .from('client_autoflow_step_overrides')
      .select('title, description, questions')
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

  const tpl = flow.autoflow_templates as unknown as { core_questions: unknown[]; total_steps: number; type: string } | null
  const coachId = (flow as unknown as Record<string, unknown>).coach_id as string | null

  // Use actual step count from DB to guard against stale total_steps
  const { count: actualTotalSteps } = await admin
    .from('autoflow_template_steps')
    .select('step_number', { count: 'exact', head: true })
    .eq('template_id', flow.template_id)

  // Access control: if step not yet submitted, check if it's unlocked
  if (!existing && templateStep) {
    const triggerType: string = (templateStep as unknown as Record<string, unknown>).trigger_type as string ?? 'day_offset'
    const triggerStepNum: number | null = (templateStep as unknown as Record<string, unknown>).trigger_step_number as number | null

    if (triggerType === 'day_offset') {
      const [y, m, d] = flow.start_date.split('-').map(Number)
      const dayOffset: number = (templateStep as unknown as Record<string, unknown>).day_offset as number ?? 0
      const availableMs = Date.UTC(y, m - 1, d + dayOffset)
      const now = new Date()
      const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      if (todayMs < availableMs) {
        const availableFrom = new Date(availableMs).toISOString().split('T')[0]
        return Response.json({ locked: true, reason: 'not_yet', available_from: availableFrom }, { status: 403 })
      }
    } else if (triggerType === 'on_step_complete' && triggerStepNum) {
      const { data: triggerResp } = await admin
        .from('autoflow_responses')
        .select('id')
        .eq('client_autoflow_id', flowId)
        .eq('step_number', triggerStepNum)
        .maybeSingle()
      if (!triggerResp) {
        return Response.json({ locked: true, reason: 'complete_previous_step', required_step: triggerStepNum }, { status: 403 })
      }
    }
  }

  // Determine if next step will be available after this submission
  let next_step_available = false
  const totalSteps = actualTotalSteps ?? tpl?.total_steps ?? 1
  if (stepNum < totalSteps) {
    const { data: nextTemplateStep } = await admin
      .from('autoflow_template_steps')
      .select('trigger_type, trigger_step_number, day_offset')
      .eq('template_id', flow.template_id)
      .eq('step_number', stepNum + 1)
      .maybeSingle()

    if (nextTemplateStep) {
      const nextTrigger: string = (nextTemplateStep as unknown as Record<string, unknown>).trigger_type as string ?? 'day_offset'
      if (nextTrigger === 'day_offset') {
        const [y, m, d] = flow.start_date.split('-').map(Number)
        const nextOffset: number = (nextTemplateStep as unknown as Record<string, unknown>).day_offset as number ?? 0
        const availableMs = Date.UTC(y, m - 1, d + nextOffset)
        const now = new Date()
        const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        next_step_available = todayMs >= availableMs
      } else if (nextTrigger === 'on_step_complete') {
        const requiredStep: number = (nextTemplateStep as unknown as Record<string, unknown>).trigger_step_number as number ?? stepNum
        if (requiredStep === stepNum) {
          // Next step unlocks when current step completes — will be true after submission
          next_step_available = true
        } else {
          const { data: requiredResp } = await admin
            .from('autoflow_responses')
            .select('id')
            .eq('client_autoflow_id', flowId)
            .eq('step_number', requiredStep)
            .maybeSingle()
          next_step_available = !!requiredResp
        }
      }
    }
  }

  // Auto-assign this step's resources to the client's resource library (idempotent)
  const resourceIds: string[] = Array.isArray(templateStep?.resource_ids) ? templateStep.resource_ids as string[] : []
  if (resourceIds.length > 0 && coachId) {
    const rows = resourceIds.map(rid => ({
      resource_id: rid,
      client_id: user.id,
      coach_id: coachId,
    }))
    await admin
      .from('client_resource_access')
      .upsert(rows, { onConflict: 'resource_id,client_id' })
  }

  // Resolve resource details — scope to the owning coach for data isolation
  let resources: unknown[] = []
  if (resourceIds.length > 0) {
    const resourceQuery = admin
      .from('coach_resources')
      .select('id, name, description, type, url')
      .in('id', resourceIds)
    if (coachId) resourceQuery.eq('coach_id', coachId)
    const { data: res } = await resourceQuery
    resources = res ?? []
  }

  // Resolve linked form title
  let linkedForm: { id: string; title: string } | null = null
  if (templateStep?.form_id) {
    const { data: form } = await admin
      .from('forms')
      .select('id, title')
      .eq('id', templateStep.form_id)
      .single()
    linkedForm = form ?? null
  }

  return Response.json({
    flow_id: flowId,
    flow_name: flow.name,
    step_number: stepNum,
    total_steps: totalSteps,
    type: tpl?.type ?? 'weekly_checkin',
    title: override?.title ?? templateStep?.title ?? `Step ${stepNum}`,
    description: override?.description ?? templateStep?.description ?? null,
    core_questions: tpl?.core_questions ?? [],
    questions: override?.questions ?? templateStep?.questions ?? [],
    resources,
    tasks: templateStep?.tasks ?? [],
    linked_form: linkedForm,
    existing_submission: existing ?? null,
    next_step_available,
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
    .select('id, coach_id, template_id, show_as_checkin_prompt')
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

  // Log a check-in record when this is a check-in prompt flow
  const isCheckinFlow = (flow as unknown as Record<string, unknown>).show_as_checkin_prompt as boolean ?? false
  if (isCheckinFlow) {
    const adminClient = createAdminClient()
    // Extract common check-in fields from answers if present
    const a = answers as Record<string, unknown> ?? {}
    const notes = typeof a.notes === 'string' ? a.notes : null
    const weight = a.weight !== undefined ? Number(a.weight) || null : null
    const mood = typeof a.mood === 'string' ? a.mood : null
    const adherence = a.adherence !== undefined ? Number(a.adherence) || null : null
    await adminClient.from('check_ins').insert({
      user_id: user.id,
      ...(notes !== null ? { notes } : {}),
      ...(weight !== null ? { weight } : {}),
      ...(mood !== null ? { mood } : {}),
      ...(adherence !== null ? { adherence } : {}),
    })
  }

  // Send automated messages for any steps that unlock because this step just completed
  const coachId = (flow as unknown as Record<string, unknown>).coach_id as string | null
  const templateId = (flow as unknown as Record<string, unknown>).template_id as string | null
  if (coachId && templateId) {
    const adminClient = createAdminClient()
    const { data: nextSteps } = await adminClient
      .from('autoflow_template_steps')
      .select('step_number, automated_message')
      .eq('template_id', templateId)
      .eq('trigger_type', 'on_step_complete')
      .eq('trigger_step_number', stepNum)

    const stepsWithMessages = (nextSteps ?? []).filter(
      (s) => (s as unknown as Record<string, unknown>).automated_message
    )

    if (stepsWithMessages.length > 0) {
      const { data: convo } = await adminClient
        .from('conversations')
        .upsert({ coach_id: coachId, client_id: user.id }, { onConflict: 'coach_id,client_id', ignoreDuplicates: false })
        .select('id')
        .single()

      if (convo?.id) {
        const msgRows = stepsWithMessages.map((s) => ({
          conversation_id: convo.id,
          sender_id: coachId,
          body: (s as unknown as Record<string, unknown>).automated_message as string,
        }))
        await adminClient.from('messages').insert(msgRows)
        await adminClient
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', convo.id)
      }
    }
  }

  return Response.json({ ok: true })
}
