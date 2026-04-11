import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DeleteSubmissionButton from './DeleteSubmissionButton'

type Ctx = { params: Promise<{ formId: string; submissionId: string }> }

export default async function SubmissionDetailPage({ params }: Ctx) {
  const { formId, submissionId } = await params
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()
  const admin = createAdminClient()

  // Admin client — RLS blocks coach from reading client's submission
  const { data: sub } = await admin
    .from('form_submissions')
    .select('id, client_id, submitted_at, form_id')
    .eq('id', submissionId)
    .eq('coach_id', coachId)
    .single()

  if (!sub) redirect(`/coach/forms/${formId}/responses`)

  // Mark viewed
  await admin.from('form_submissions').update({ viewed_by_coach: true }).eq('id', submissionId)

  const [{ data: answers }, { data: profile }, { data: form }] = await Promise.all([
    admin
      .from('form_answers')
      .select('question_id, value, form_questions(label, type, order_index)')
      .eq('submission_id', submissionId),
    admin.from('profiles').select('email').eq('id', sub.client_id).single(),
    admin.from('forms').select('title').eq('id', sub.form_id).single(),
  ])

  // Supabase returns the related row as a single object (not array) for many-to-one
  type QuestionRef = { label: string; type: string; order_index: number } | null

  const sorted = (answers ?? []).sort((a, b) => {
    const oa = (a.form_questions as unknown as QuestionRef)?.order_index ?? 0
    const ob = (b.form_questions as unknown as QuestionRef)?.order_index ?? 0
    return oa - ob
  })

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <a href={`/coach/forms/${formId}/responses`} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{form?.title ?? 'Submission'}</h1>
          <p className="text-xs text-gray-400">
            {profile?.email} · {new Date(sub.submitted_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <DeleteSubmissionButton submissionId={submissionId} formId={formId} />
      </div>

      <main className="max-w-2xl mx-auto w-full p-6 space-y-4">
        {sorted.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No answers recorded.</p>
        )}
        {sorted.map((a, i) => {
          const q = a.form_questions as unknown as QuestionRef
          return (
            <div key={i} className="bg-white rounded-2xl border p-5 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{q?.label ?? 'Question'}</p>
              <p className="text-gray-900 text-sm whitespace-pre-wrap">{a.value || <span className="text-gray-400 italic">No answer</span>}</p>
            </div>
          )
        })}
      </main>
    </div>
  )
}
