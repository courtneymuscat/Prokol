import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ formId: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { formId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Use admin client — clients can't read coach-owned forms via RLS
  const admin = createAdminClient()
  const { data: form } = await admin
    .from('forms')
    .select('id, coach_id, is_active, is_org_template, org_id')
    .eq('id', formId)
    .single()

  if (!form) return Response.json({ error: 'Form not found' }, { status: 404 })

  // Resolve which coach is actually assigning this form to the client. For
  // an own-form it's the form owner; for an org-template form it's whichever
  // coach in the org has an active relationship with the client (the form's
  // coach_id is the org owner, not the assigning coach).
  // The actual coach_clients.status values are 'active' / 'archived' /
  // 'pending_invite' (the codebase uses 'pending_invite' everywhere else).
  // The earlier 'pending' here was a typo that silently blocked form
  // submissions for clients whose row was still pending_invite at the moment
  // of submission.
  const COACH_REL_STATUSES = ['active', 'pending_invite', 'archived']

  let assigningCoachId: string | null = null
  const { data: ownRel } = await admin
    .from('coach_clients')
    .select('coach_id')
    .eq('coach_id', form.coach_id)
    .eq('client_id', session.user.id)
    .in('status', COACH_REL_STATUSES)
    .maybeSingle()
  if (ownRel) {
    assigningCoachId = form.coach_id as string
  } else if (form.is_org_template && form.org_id) {
    // Find a coach in the same org who's actually assigned to this client.
    const { data: clientRel } = await admin
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', session.user.id)
      .in('status', COACH_REL_STATUSES)
    const orgCoachIds = clientRel?.map((r) => r.coach_id as string) ?? []
    if (orgCoachIds.length) {
      const { data: orgMember } = await admin
        .from('org_members')
        .select('user_id')
        .eq('org_id', form.org_id)
        .in('user_id', orgCoachIds)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (orgMember?.user_id) assigningCoachId = orgMember.user_id as string
    }
  }

  if (!assigningCoachId) return Response.json({ error: 'Not authorised to submit this form' }, { status: 403 })

  const { answers, submission_id: existingSubmissionId }: { answers: Record<string, string>; submission_id?: string } = await req.json()

  let submissionId: string

  if (existingSubmissionId) {
    // Verify this submission belongs to the current user
    const { data: existing } = await admin
      .from('form_submissions')
      .select('id')
      .eq('id', existingSubmissionId)
      .eq('client_id', session.user.id)
      .single()
    if (!existing) return Response.json({ error: 'Submission not found' }, { status: 404 })

    // Update submitted_at timestamp
    await admin
      .from('form_submissions')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', existingSubmissionId)

    // Delete old answers and re-insert
    await admin.from('form_answers').delete().eq('submission_id', existingSubmissionId)
    submissionId = existingSubmissionId
  } else {
    // Resolve whether this submission should be persisted to the coach's
    // Files tab. The save-to-file flag lives on the *source* — either the
    // coach_invites row that sent the client here, or the
    // autoflow_template_steps row that linked to this form (or a task
    // inside that step). If any of those say save_to_file = true, mark the
    // submission accordingly so the Files tab includes it explicitly.
    let saveToFile = false
    try {
      // Source 1: coach_invites row that triggered the client's signup,
      // where the coach attached this form on the invite.
      const { data: inviteSource } = await admin
        .from('coach_invites')
        .select('form_save_to_file')
        .eq('form_id', formId)
        .eq('coach_id', assigningCoachId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if ((inviteSource as Record<string, unknown> | null)?.form_save_to_file === true) {
        saveToFile = true
      }
    } catch { /* column may not exist in older deployments */ }
    if (!saveToFile) {
      try {
        // Source 2: autoflow template steps that point at this form. We
        // need the steps belonging to a template the assigning coach
        // actually assigned to this client.
        const { data: assignedFlows } = await admin
          .from('client_autoflows')
          .select('template_id')
          .eq('coach_id', assigningCoachId)
          .eq('client_id', session.user.id)
        const tplIds = [...new Set((assignedFlows ?? []).map((f) => f.template_id).filter(Boolean) as string[])]
        if (tplIds.length) {
          const { data: stepRows } = await admin
            .from('autoflow_template_steps')
            .select('form_save_to_file, tasks')
            .in('template_id', tplIds)
            .eq('form_id', formId)
          for (const r of stepRows ?? []) {
            const rec = r as Record<string, unknown>
            if (rec.form_save_to_file === true) { saveToFile = true; break }
            // Source 3: a task inside the step with link_save_to_file = true
            // pointing at this form (link_url contains the form id).
            const tasks = Array.isArray(rec.tasks) ? rec.tasks as Array<Record<string, unknown>> : []
            const taskMatch = tasks.find((t) =>
              t.link_save_to_file === true &&
              typeof t.link_url === 'string' &&
              (t.link_url as string).includes(formId),
            )
            if (taskMatch) { saveToFile = true; break }
          }
        }
      } catch { /* column may not exist in older deployments */ }
    }

    // Create new submission. Attribute it to the assigning coach so they
    // (not the form owner) see it in their inbox. Try writing the
    // save_to_file flag; fall back gracefully if the column isn't present.
    const insertRow: Record<string, unknown> = {
      form_id: formId,
      client_id: session.user.id,
      coach_id: assigningCoachId,
      submitted_at: new Date().toISOString(),
    }
    if (saveToFile) insertRow.save_to_file = true

    let submission: { id: string } | null = null
    const firstAttempt = await admin
      .from('form_submissions')
      .insert(insertRow)
      .select('id')
      .single()
    if (firstAttempt.error && /save_to_file/i.test(firstAttempt.error.message)) {
      // Column doesn't exist yet — retry without the flag so the submission
      // still goes through. Files tab will still surface it because the
      // existing Files API includes every form_submission for the coach.
      delete insertRow.save_to_file
      const retry = await admin
        .from('form_submissions')
        .insert(insertRow)
        .select('id')
        .single()
      if (retry.error) return Response.json({ error: retry.error.message }, { status: 500 })
      submission = retry.data
    } else if (firstAttempt.error) {
      return Response.json({ error: firstAttempt.error.message }, { status: 500 })
    } else {
      submission = firstAttempt.data
    }
    submissionId = submission!.id
  }

  // Insert answers
  const answerRows = Object.entries(answers).map(([question_id, value]) => ({
    submission_id: submissionId,
    question_id,
    value: String(value),
  }))

  if (answerRows.length) {
    await admin.from('form_answers').insert(answerRows)
  }

  // Mark coached client's onboarding as complete after form submission
  await admin
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', session.user.id)
    .eq('subscription_tier', 'coached')

  // Log a check-in record if this form is used in a check-in schedule
  const { data: schedule } = await admin
    .from('checkin_schedules')
    .select('id')
    .eq('form_id', formId)
    .eq('client_id', session.user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (schedule) {
    await admin.from('check_ins').insert({ user_id: session.user.id })
  }

  return Response.json({ id: submissionId })
}
