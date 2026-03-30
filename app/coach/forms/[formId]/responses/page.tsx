import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ formId: string }> }

export default async function FormResponsesPage({ params }: Ctx) {
  const { formId } = await params
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: form } = await supabase
    .from('forms')
    .select('id, title, type')
    .eq('id', formId)
    .eq('coach_id', coachId)
    .single()

  if (!form) redirect('/coach/forms')

  // Admin client — RLS blocks coach from reading another user's form_submissions
  const { data: submissions } = await admin
    .from('form_submissions')
    .select('id, client_id, submitted_at, viewed_by_coach')
    .eq('form_id', formId)
    .eq('coach_id', coachId)
    .order('submitted_at', { ascending: false })

  const clientIds = [...new Set((submissions ?? []).map((s) => s.client_id))]
  const { data: profiles } = await admin.from('profiles').select('id, email').in('id', clientIds.length ? clientIds : ['none'])
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email]))

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <a href="/coach/forms" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{form.title}</h1>
          <p className="text-xs text-gray-400">{submissions?.length ?? 0} response{submissions?.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto w-full p-6 space-y-3">
        {(!submissions || submissions.length === 0) && (
          <div className="bg-white rounded-2xl border p-10 text-center">
            <p className="text-gray-500 font-medium">No responses yet</p>
            <p className="text-gray-400 text-sm mt-1">Share the form link with your clients.</p>
          </div>
        )}

        {(submissions ?? []).map((sub) => (
          <a
            key={sub.id}
            href={`/coach/forms/${formId}/responses/${sub.id}`}
            className="flex items-center justify-between bg-white rounded-2xl border p-4 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-blue-600">
                  {(profileMap[sub.client_id] ?? '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{profileMap[sub.client_id] ?? 'Unknown'}</p>
                  {!sub.viewed_by_coach && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold">New</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(sub.submitted_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        ))}
      </main>
    </div>
  )
}
