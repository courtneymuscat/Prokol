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
        .select('template_id, step_number, title, description, questions, form_id, resource_ids, tasks')
        .in('template_id', [...checkinTemplateIds]),
      checkinFlowIds.length
        ? admin
            .from('client_autoflow_step_overrides')
            .select('client_autoflow_id, step_number, title, description, questions')
            .in('client_autoflow_id', checkinFlowIds)
        : Promise.resolve({ data: [] }),
    ])

    const coreQByTemplate: Record<string, { id: string; label: string; type: string }[]> = {}
    for (const t of templates ?? []) {
      const cqs = (t.core_questions as { id: string; label: string; type: string }[] | null) ?? []
      coreQByTemplate[t.id] = cqs.filter((q) => q.type !== 'note' && q.type !== 'section')
    }

    type StepTask = { id: string; label: string; link_type?: string | null; link_url?: string | null; link_label?: string | null }
    type StepMeta = {
      title: string | null
      description: string | null
      questions: { id: string; label: string; type: string }[]
      form_id: string | null
      resource_ids: string[]
      tasks: StepTask[]
    }
    const stepMetaByTemplate: Record<string, Record<number, StepMeta>> = {}
    for (const s of steps ?? []) {
      const rec = s as Record<string, unknown>
      if (!stepMetaByTemplate[s.template_id]) stepMetaByTemplate[s.template_id] = {}
      const qs = (s.questions as { id: string; label: string; type: string }[] | null) ?? []
      const rawTasks = Array.isArray(rec.tasks) ? rec.tasks as Array<Record<string, unknown>> : []
      stepMetaByTemplate[s.template_id][s.step_number] = {
        title: (rec.title as string | null) ?? null,
        description: (rec.description as string | null) ?? null,
        questions: qs.filter((q) => q.type !== 'note' && q.type !== 'section'),
        form_id: (rec.form_id as string | null) ?? null,
        resource_ids: Array.isArray(rec.resource_ids) ? rec.resource_ids as string[] : [],
        tasks: rawTasks.map((t) => ({
          id: t.id as string,
          label: t.label as string,
          link_type: (t.link_type as string | null) ?? null,
          link_url: (t.link_url as string | null) ?? null,
          link_label: (t.link_label as string | null) ?? null,
        })),
      }
    }

    // Per-client step overrides take precedence over template values for any
    // field they explicitly set (title, description, questions).
    const overrideMetaMap: Record<string, Record<number, Partial<StepMeta>>> = {}
    for (const ov of stepOverrides ?? []) {
      const rec = ov as Record<string, unknown>
      if (!overrideMetaMap[ov.client_autoflow_id]) overrideMetaMap[ov.client_autoflow_id] = {}
      const patch: Partial<StepMeta> = {}
      if (rec.title != null) patch.title = rec.title as string
      if (rec.description != null) patch.description = rec.description as string
      if (rec.questions != null) {
        const qs = (rec.questions as { id: string; label: string; type: string }[] | null) ?? []
        patch.questions = qs.filter((q) => q.type !== 'note' && q.type !== 'section')
      }
      overrideMetaMap[ov.client_autoflow_id][ov.step_number] = patch
    }

    // Helper: extract a form id from a task's link_url. The autoflow editor
    // writes either a bare uuid, a /forms/<id> path, or a full URL with the
    // id as the last path segment (sometimes followed by a return query).
    function extractFormIdFromLink(url: string | null | undefined): string | null {
      if (!url) return null
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      const match = url.match(uuidPattern)
      return match ? match[0] : null
    }

    // Pre-resolve resources + form titles + form submissions across all steps,
    // so each check-in entry can carry its linked artefacts forward without
    // an N+1 lookup per row. Also includes form IDs referenced from tasks
    // (where link_type='form'), so those task links can be re-pointed at
    // the actual submission viewer instead of the blank form.
    const allResourceIds = new Set<string>()
    const allFormIds = new Set<string>()
    for (const tplMap of Object.values(stepMetaByTemplate)) {
      for (const meta of Object.values(tplMap)) {
        for (const rid of meta.resource_ids) allResourceIds.add(rid)
        if (meta.form_id) allFormIds.add(meta.form_id)
        for (const t of meta.tasks) {
          if (t.link_type === 'form') {
            const fid = extractFormIdFromLink(t.link_url)
            if (fid) allFormIds.add(fid)
          }
        }
      }
    }
    const resourceById: Record<string, { id: string; name: string; type: string; url: string | null }> = {}
    if (allResourceIds.size > 0) {
      const { data: resRows } = await admin
        .from('coach_resources')
        .select('id, name, type, url')
        .in('id', [...allResourceIds])
      for (const r of resRows ?? []) {
        resourceById[r.id] = { id: r.id, name: r.name, type: r.type, url: (r as Record<string, unknown>).url as string | null }
      }
    }
    const formTitleById: Record<string, string> = {}
    const formSubmissionsByForm: Record<string, { id: string; submitted_at: string }[]> = {}
    if (allFormIds.size > 0) {
      const [{ data: formRows }, { data: subRows }] = await Promise.all([
        admin.from('forms').select('id, title').in('id', [...allFormIds]),
        admin
          .from('form_submissions')
          .select('id, form_id, submitted_at')
          .in('form_id', [...allFormIds])
          .eq('client_id', clientId)
          .order('submitted_at', { ascending: false }),
      ])
      for (const f of formRows ?? []) formTitleById[f.id] = f.title
      for (const s of subRows ?? []) {
        if (!formSubmissionsByForm[s.form_id]) formSubmissionsByForm[s.form_id] = []
        formSubmissionsByForm[s.form_id].push({ id: s.id, submitted_at: s.submitted_at })
      }
    }

    autoflowCheckIns = (resps ?? []).map((r) => {
      const templateId = flowTemplateById[r.client_autoflow_id]
      const coreQs = coreQByTemplate[templateId] ?? []
      const tplMeta = stepMetaByTemplate[templateId]?.[r.step_number]
      const overrideMeta = overrideMetaMap[r.client_autoflow_id]?.[r.step_number]
      const stepQs = overrideMeta?.questions ?? tplMeta?.questions ?? []
      const stepTitle = overrideMeta?.title ?? tplMeta?.title ?? null
      const stepDescription = overrideMeta?.description ?? tplMeta?.description ?? null
      const answers = (r.answers as Record<string, string>) ?? {}

      // Resources attached to this step (resolved to id + name + type + url)
      const resources = (tplMeta?.resource_ids ?? [])
        .map((rid) => resourceById[rid])
        .filter(Boolean) as { id: string; name: string; type: string; url: string | null }[]

      // Tasks with completion status derived from the response's answers
      // (the client UI writes `task_<id>: 'done' | 'skipped'` on submit).
      // For tasks that link to a form, swap the link to the actual response
      // viewer if the client has submitted — so the coach lands on the
      // filled-in form, not the blank template.
      const tasks = (tplMeta?.tasks ?? []).map((t) => {
        let linkUrl = t.link_url ?? null
        let submissionId: string | null = null
        if (t.link_type === 'form') {
          const fid = extractFormIdFromLink(t.link_url)
          if (fid) {
            const subs = formSubmissionsByForm[fid] ?? []
            const stepAt = new Date(r.submitted_at).getTime()
            let best: { id: string; submitted_at: string } | null = null
            for (const s of subs) {
              const subAt = new Date(s.submitted_at).getTime()
              if (subAt <= stepAt) {
                if (!best || new Date(best.submitted_at).getTime() < subAt) best = s
              }
            }
            if (!best && subs.length) best = subs[0]
            if (best) {
              submissionId = best.id
              // Re-point coach link at the response viewer
              linkUrl = `/coach/forms/${fid}/responses/${best.id}`
            }
          }
        }
        return {
          id: t.id,
          label: t.label,
          link_type: t.link_type ?? null,
          link_url: linkUrl,
          link_label: t.link_label ?? null,
          completed: answers[`task_${t.id}`] === 'done',
          submission_id: submissionId,
        }
      })

      // Linked form: title + most relevant submission (nearest to the
      // step's submitted_at, falling back to the most recent submission).
      let linkedForm: { id: string; title: string; submission_id: string | null } | null = null
      if (tplMeta?.form_id) {
        const subs = formSubmissionsByForm[tplMeta.form_id] ?? []
        // Prefer the submission closest to (and <=) this step's submitted_at,
        // otherwise the most recent one.
        const stepAt = new Date(r.submitted_at).getTime()
        let best: { id: string; submitted_at: string } | null = null
        for (const s of subs) {
          const subAt = new Date(s.submitted_at).getTime()
          if (subAt <= stepAt) {
            if (!best || new Date(best.submitted_at).getTime() < subAt) best = s
          }
        }
        if (!best && subs.length) best = subs[0]
        linkedForm = {
          id: tplMeta.form_id,
          title: formTitleById[tplMeta.form_id] ?? 'Form',
          submission_id: best?.id ?? null,
        }
      }

      return {
        id: r.id,
        flow_id: r.client_autoflow_id,
        flow_name: flowNameById[r.client_autoflow_id] ?? 'Check-in',
        step_number: r.step_number,
        step_title: stepTitle,
        step_description: stepDescription,
        submitted_at: r.submitted_at,
        answers,
        questions: [...coreQs, ...stepQs],
        reviewed_by_coach: (r as Record<string, unknown>).reviewed_by_coach as boolean ?? false,
        coach_feedback: (r as Record<string, unknown>).coach_feedback as string | null ?? null,
        resources,
        tasks,
        linked_form: linkedForm,
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
