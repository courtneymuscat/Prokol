import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Verify coach-client relationship (RLS-checked)
  const supabase = await createClient()
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived'])
    .single()
  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Admin client — coach reading another user's data is blocked by RLS
  const admin = createAdminClient()

  const [submissionsRes, coachFilesRes] = await Promise.all([
    admin
      .from('form_submissions')
      .select('id, submitted_at, forms ( title ), form_answers ( value, form_questions ( label, type ) )')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .order('submitted_at', { ascending: false }),
    admin
      .from('client_files')
      .select('id, url, name, created_at, uploaded_by')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false }),
  ])

  const files: { id?: string; url: string; label: string; formTitle: string; submittedAt: string; source: string }[] = []

  // Files from form submissions (client-uploaded via file_upload questions)
  for (const submission of submissionsRes.data ?? []) {
    const formsField = submission.forms as unknown as { title: string } | { title: string }[] | null
    const formTitle = (Array.isArray(formsField) ? formsField[0] : formsField)?.title ?? 'Form'
    const answers = submission.form_answers as unknown as { value: string; form_questions: { label: string; type: string } | null }[]
    for (const answer of answers ?? []) {
      const q = answer.form_questions
      if (q?.type === 'file_upload' && answer.value?.startsWith('http')) {
        files.push({ url: answer.value, label: q.label, formTitle, submittedAt: submission.submitted_at ?? '', source: 'client' })
      }
    }
  }

  // Files uploaded directly by coach
  for (const f of coachFilesRes.data ?? []) {
    files.push({ id: f.id, url: f.url, label: f.name, formTitle: 'Coach upload', submittedAt: f.created_at, source: 'coach' })
  }

  files.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
  return Response.json(files)
}
