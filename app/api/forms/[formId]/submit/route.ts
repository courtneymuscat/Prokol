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

  if (!form || !form.is_active) return Response.json({ error: 'Form not found' }, { status: 404 })

  // Verify client belongs to this coach (admin client — RLS may block client reading coach_clients)
  const { data: rel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', form.coach_id)
    .eq('client_id', session.user.id)
    .eq('status', 'active')
    .single()

  if (!rel) return Response.json({ error: 'Not authorised to submit this form' }, { status: 403 })

  const { answers }: { answers: Record<string, string> } = await req.json()

  // Create submission
  const { data: submission, error: subError } = await admin
    .from('form_submissions')
    .insert({ form_id: formId, client_id: session.user.id, coach_id: form.coach_id, submitted_at: new Date().toISOString() })
    .select('id')
    .single()

  if (subError) return Response.json({ error: subError.message }, { status: 500 })

  // Insert answers
  const answerRows = Object.entries(answers).map(([question_id, value]) => ({
    submission_id: submission.id,
    question_id,
    value: String(value),
  }))

  if (answerRows.length) {
    await admin.from('form_answers').insert(answerRows)
  }

  return Response.json({ id: submission.id })
}
