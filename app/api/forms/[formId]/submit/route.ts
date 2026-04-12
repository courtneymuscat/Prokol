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
    .select('id, coach_id, is_active')
    .eq('id', formId)
    .single()

  if (!form) return Response.json({ error: 'Form not found' }, { status: 404 })

  // Verify client belongs to this coach (admin client — RLS may block client reading coach_clients)
  // Accept any non-removed status so onboarding forms work before the client is fully 'active'
  const { data: rel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', form.coach_id)
    .eq('client_id', session.user.id)
    .in('status', ['active', 'pending', 'archived'])
    .maybeSingle()

  if (!rel) return Response.json({ error: 'Not authorised to submit this form' }, { status: 403 })

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
    // Create new submission
    const { data: submission, error: subError } = await admin
      .from('form_submissions')
      .insert({ form_id: formId, client_id: session.user.id, coach_id: form.coach_id, submitted_at: new Date().toISOString() })
      .select('id')
      .single()
    if (subError) return Response.json({ error: subError.message }, { status: 500 })
    submissionId = submission.id
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
