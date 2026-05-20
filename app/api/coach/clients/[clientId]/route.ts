import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

/** Verify the coach actually owns this client relationship (active or archived) */
async function verifyAccess(coachId: string, clientId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived', 'pending_invite'])
    .single()
  return !!data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Use admin client — coach is reading another user's data, RLS would block the regular client
  const admin = createAdminClient()

  // Form submissions surface in the coach's Check-ins tab from two sources:
  //   1. Forms attached to a checkin_schedule the coach assigned to this client
  //   2. Forms attached to a step inside any client_autoflow assigned to this
  //      coach for this client (e.g. an onboarding form linked from an
  //      autoflow step or task)
  // Originally only (1) was included, which silently hid onboarding form
  // submissions from the coach view — even though the data was sitting in
  // form_submissions all along.
  const titleByFormId: Record<string, string> = {}

  const { data: checkinSchedules } = await admin
    .from('checkin_schedules')
    .select('form_id, title')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  for (const s of checkinSchedules ?? []) {
    if (s.form_id) titleByFormId[s.form_id] = s.title
  }

  // Forms attached to autoflow template steps. Works for both the assigning
  // coach's own templates and org templates (the join is by template_id
  // regardless of owner; we get the form rows via admin).
  const { data: assignedFlows } = await admin
    .from('client_autoflows')
    .select('template_id')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
  const assignedTemplateIds = [...new Set((assignedFlows ?? []).map((f) => f.template_id).filter(Boolean) as string[])]
  if (assignedTemplateIds.length) {
    const { data: stepRows } = await admin
      .from('autoflow_template_steps')
      .select('template_id, step_number, form_id, title')
      .in('template_id', assignedTemplateIds)
      .not('form_id', 'is', null)
    const stepFormIds = [...new Set((stepRows ?? []).map((r) => (r as Record<string, unknown>).form_id as string | null).filter(Boolean) as string[])]
    if (stepFormIds.length) {
      const { data: stepForms } = await admin
        .from('forms')
        .select('id, title')
        .in('id', stepFormIds)
      const formTitleById = Object.fromEntries((stepForms ?? []).map((f) => [f.id, f.title]))
      for (const r of stepRows ?? []) {
        const fid = (r as Record<string, unknown>).form_id as string
        if (!titleByFormId[fid]) {
          titleByFormId[fid] = formTitleById[fid] ?? (r as Record<string, unknown>).title as string ?? 'Autoflow form'
        }
      }
    }
  }

  const allRelevantFormIds = Object.keys(titleByFormId)

  let formCheckIns: { id: string; form_id: string; title: string; submitted_at: string; viewed_by_coach: boolean; coach_feedback: string | null }[] = []
  if (allRelevantFormIds.length) {
    const { data: subs } = await admin
      .from('form_submissions')
      .select('id, form_id, submitted_at, viewed_by_coach, coach_feedback')
      .in('form_id', allRelevantFormIds)
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: false })
      .limit(40)
    formCheckIns = (subs ?? []).map((s) => ({
      id: s.id,
      form_id: s.form_id,
      title: titleByFormId[s.form_id] ?? 'Check-in',
      submitted_at: s.submitted_at,
      viewed_by_coach: (s as Record<string, unknown>).viewed_by_coach as boolean ?? false,
      coach_feedback: (s as Record<string, unknown>).coach_feedback as string | null ?? null,
    }))
  }

  // Fetch all autoflow responses for this client
  type AutoflowCheckIn = {
    id: string; flow_id: string; flow_name: string; step_number: number
    submitted_at: string; answers: Record<string, string>
    questions: { id: string; label: string; type: string }[]
  }
  let autoflowCheckIns: AutoflowCheckIn[] = []
  const { data: clientFlows } = await admin
    .from('client_autoflows')
    .select('id, name, template_id')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (clientFlows?.length) {
    const allFlowIds = clientFlows.map((f) => f.id)
    const templateIds = [...new Set(clientFlows.map((f) => f.template_id))]
    const flowNameById: Record<string, string> = Object.fromEntries(clientFlows.map((f) => [f.id, f.name]))
    const flowTemplateById: Record<string, string> = Object.fromEntries(clientFlows.map((f) => [f.id, f.template_id]))

    const { data: templates } = await admin
      .from('autoflow_templates')
      .select('id, type, core_questions')
      .in('id', templateIds)

    // Surface every autoflow type whose responses are meaningful to the coach
    // (weekly_checkin, onboarding, custom). The original filter only included
    // weekly_checkin, which silently hid all onboarding/custom flow submissions
    // from the coach's check-ins tab — clients filled in their onboarding
    // autoflow but the coach saw nothing.
    const RESPONSE_TEMPLATE_TYPES = new Set(['weekly_checkin', 'onboarding', 'custom'])
    const checkinTemplateIds = new Set(
      (templates ?? [])
        .filter((t) => RESPONSE_TEMPLATE_TYPES.has((t as Record<string, unknown>).type as string))
        .map((t) => t.id)
    )
    const checkinFlowIds = clientFlows.filter((f) => checkinTemplateIds.has(f.template_id)).map((f) => f.id)

    const [{ data: resps }, { data: steps }, { data: stepOverrides }] = await Promise.all([
      checkinFlowIds.length
        ? admin
            .from('autoflow_responses')
            .select('id, client_autoflow_id, step_number, submitted_at, answers, reviewed_by_coach, coach_feedback')
            .in('client_autoflow_id', checkinFlowIds)
            .order('submitted_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),
      admin
        .from('autoflow_template_steps')
        .select('template_id, step_number, questions')
        .in('template_id', [...checkinTemplateIds]),
      checkinFlowIds.length
        ? admin
            .from('client_autoflow_step_overrides')
            .select('client_autoflow_id, step_number, questions')
            .in('client_autoflow_id', checkinFlowIds)
            .not('questions', 'is', null)
        : Promise.resolve({ data: [] }),
    ])

    const coreQByTemplate: Record<string, { id: string; label: string; type: string }[]> = {}
    for (const t of templates ?? []) {
      const cqs = (t.core_questions as { id: string; label: string; type: string }[] | null) ?? []
      coreQByTemplate[t.id] = cqs.filter((q) => q.type !== 'note' && q.type !== 'section')
    }

    const stepQMap: Record<string, Record<number, { id: string; label: string; type: string }[]>> = {}
    for (const s of steps ?? []) {
      if (!stepQMap[s.template_id]) stepQMap[s.template_id] = {}
      const qs = (s.questions as { id: string; label: string; type: string }[] | null) ?? []
      stepQMap[s.template_id][s.step_number] = qs.filter((q) => q.type !== 'note' && q.type !== 'section')
    }

    // Per-client step question overrides take precedence over template questions
    const overrideQMap: Record<string, Record<number, { id: string; label: string; type: string }[]>> = {}
    for (const ov of stepOverrides ?? []) {
      if (!overrideQMap[ov.client_autoflow_id]) overrideQMap[ov.client_autoflow_id] = {}
      const qs = (ov.questions as { id: string; label: string; type: string }[] | null) ?? []
      overrideQMap[ov.client_autoflow_id][ov.step_number] = qs.filter((q) => q.type !== 'note' && q.type !== 'section')
    }

    autoflowCheckIns = (resps ?? []).map((r) => {
      const templateId = flowTemplateById[r.client_autoflow_id]
      const coreQs = coreQByTemplate[templateId] ?? []
      // Use per-client override questions if present, otherwise fall back to template questions
      const stepQs = overrideQMap[r.client_autoflow_id]?.[r.step_number] ?? stepQMap[templateId]?.[r.step_number] ?? []
      return {
        id: r.id,
        flow_id: r.client_autoflow_id,
        flow_name: flowNameById[r.client_autoflow_id] ?? 'Check-in',
        step_number: r.step_number,
        submitted_at: r.submitted_at,
        answers: (r.answers as Record<string, string>) ?? {},
        questions: [...coreQs, ...stepQs],
        reviewed_by_coach: (r as Record<string, unknown>).reviewed_by_coach as boolean ?? false,
        coach_feedback: (r as Record<string, unknown>).coach_feedback as string | null ?? null,
      }
    })
  }

  const [checkIns, workoutsRaw, weightLogs, foodLogs, mealNotesRaw, customMetricsRes, customMetricLogsRes] = await Promise.all([
    admin
      .from('check_ins')
      .select('id, created_at, sleep_hours, sleep_quality, energy_level, rhr, hrv, notes, coach_feedback, reviewed_by_coach')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20),

    admin
      .from('workouts')
      .select('id, name, started_at, ended_at')
      .eq('user_id', clientId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20),

    admin
      .from('weight_logs')
      .select('logged_at, weight_lbs, weight_unit')
      .eq('user_id', clientId)
      .order('logged_at', { ascending: false })
      .limit(30),

    admin
      .from('food_logs')
      .select('id, log_date, meal_type, food_name, calories, protein, carbs, fat, scan_image_url, meal_notes, meal_photo_url')
      .eq('user_id', clientId)
      .order('log_date', { ascending: false })
      .limit(50),

    admin
      .from('meal_notes')
      .select('log_date, meal_type, note, photo_url')
      .eq('user_id', clientId)
      .order('log_date', { ascending: false })
      .limit(50),

    admin
      .from('custom_metrics')
      .select('id, name, unit, sort_order')
      .eq('user_id', clientId)
      .eq('archived', false)
      .order('sort_order', { ascending: true }),

    admin
      .from('custom_metric_logs')
      .select('id, metric_id, value, logged_at')
      .eq('user_id', clientId)
      .order('logged_at', { ascending: false })
      .limit(500),
  ])

  // Fetch exercise details for workouts
  const workoutIds = (workoutsRaw.data ?? []).map((w) => w.id)
  const workoutExercises = workoutIds.length
    ? await admin
        .from('workout_exercises')
        .select('workout_id, order_index, notes, video_url, exercises(id, name, category)')
        .in('workout_id', workoutIds)
        .order('order_index')
    : { data: [] }

  const workouts = (workoutsRaw.data ?? []).map((w) => ({
    ...w,
    exercises: ((workoutExercises.data ?? []) as unknown as Array<{
      workout_id: string
      order_index: number
      notes: string | null
      video_url: string | null
      exercises: { id: string; name: string; category: string } | null
    }>)
      .filter((we) => we.workout_id === w.id)
      .map((we) => ({
        name: we.exercises?.name ?? '',
        category: we.exercises?.category ?? '',
        notes: we.notes ?? null,
        video_url: we.video_url ?? null,
      })),
  }))

  const realCheckIns = (checkIns.data ?? []).filter(
    (c) => c.sleep_hours != null || c.sleep_quality != null || c.energy_level != null || c.rhr != null || c.hrv != null || c.notes != null
  )

  return Response.json({
    checkIns: realCheckIns,
    formCheckIns,
    autoflowCheckIns,
    workouts,
    weightLogs: weightLogs.data ?? [],
    foodLogs: foodLogs.data ?? [],
    mealNotes: mealNotesRaw.data ?? [],
    customMetrics: customMetricsRes.data ?? [],
    customMetricLogs: customMetricLogsRes.data ?? [],
  })
}

/** Archive client — reverts to free tier, coach can still view history */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  await supabase
    .from('coach_clients')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({ subscription_tier: 'individual_free' })
    .eq('id', clientId)

  return Response.json({ ok: true })
}

/** Remove client from coach's roster */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  await supabase
    .from('coach_clients')
    .update({ status: 'removed' })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  // Revert client to free tier — admin client bypasses RLS on profiles
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({ subscription_tier: 'individual_free' })
    .eq('id', clientId)

  return Response.json({ ok: true })
}
