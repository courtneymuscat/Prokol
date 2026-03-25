import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  // Verify coach-client relationship
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .single()

  if (!rel) return Response.json({ error: 'Client not found' }, { status: 404 })

  // Get all file_upload answers for this client
  const { data, error } = await supabase
    .from('form_submissions')
    .select(`
      id,
      created_at,
      forms ( title ),
      form_answers (
        value,
        form_questions ( label, type )
      )
    `)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Flatten to just file upload answers
  const files: { url: string; label: string; formTitle: string; submittedAt: string }[] = []

  for (const submission of data ?? []) {
    const formTitle = (submission.forms as unknown as { title: string } | null)?.title ?? 'Form'
    for (const answer of (submission.form_answers as unknown as { value: string; form_questions: { label: string; type: string } | null }[] ?? [])) {
      const q = answer.form_questions
      if (q?.type === 'file_upload' && answer.value?.startsWith('http')) {
        files.push({
          url: answer.value,
          label: q.label,
          formTitle,
          submittedAt: submission.created_at,
        })
      }
    }
  }

  return Response.json(files)
}
