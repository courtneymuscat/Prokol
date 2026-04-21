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
    .in('status', ['active', 'archived'])
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

  // Fetch form submissions linked to this client's check-in schedules
  const { data: checkinSchedules } = await admin
    .from('checkin_schedules')
    .select('form_id, title')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  const scheduleFormIds = (checkinSchedules ?? []).map((s) => s.form_id).filter(Boolean) as string[]
  const scheduleTitleByFormId: Record<string, string> = {}
  for (const s of checkinSchedules ?? []) {
    if (s.form_id) scheduleTitleByFormId[s.form_id] = s.title
  }

  let formCheckIns: { id: string; form_id: string; title: string; submitted_at: string; viewed_by_coach: boolean; coach_feedback: string | null }[] = []
  if (scheduleFormIds.length) {
    const { data: subs } = await admin
      .from('form_submissions')
      .select('id, form_id, submitted_at, viewed_by_coach, coach_feedback')
      .in('form_id', scheduleFormIds)
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: false })
      .limit(20)
    formCheckIns = (subs ?? []).map((s) => ({
      id: s.id,
      form_id: s.form_id,
      title: scheduleTitleByFormId[s.form_id] ?? 'Check-in',
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

    // Only show check-in type flows in the check-ins tab
    const checkinTemplateIds = new Set(
      (templates ?? []).filter((t) => t.type === 'weekly_checkin').map((t) => t.id)
    )
    const checkinFlowIds = clientFlows.filter((f) => checkinTemplateIds.has(f.template_id)).map((f) => f.id)

    const [{ data: resps }, { data: steps }] = await Promise.all([
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

    autoflowCheckIns = (resps ?? []).map((r) => {
      const templateId = flowTemplateById[r.client_autoflow_id]
      const coreQs = coreQByTemplate[templateId] ?? []
      const stepQs = stepQMap[templateId]?.[r.step_number] ?? []
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

  const [checkIns, workoutsRaw, weightLogs, foodLogs, mealNotesRaw] = await Promise.all([
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
