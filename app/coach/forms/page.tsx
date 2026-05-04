import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import FormTemplates from './FormTemplates'
import JotFormImport from './JotFormImport'
import PasteImport from './PasteImport'
import DeleteFormButton from './DeleteFormButton'

const TYPE_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  weekly_checkin: 'Weekly check-in',
  custom: 'Custom',
}

export default async function CoachFormsPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, type, is_active, created_at')
    .eq('coach_id', coachId)
    .or('is_client_copy.is.null,is_client_copy.eq.false')
    .order('created_at', { ascending: false })

  // Get unread submission counts per form
  const { data: unread } = await supabase
    .from('form_submissions')
    .select('form_id')
    .eq('coach_id', coachId)
    .eq('viewed_by_coach', false)

  const unreadMap: Record<string, number> = {}
  for (const r of unread ?? []) {
    unreadMap[r.form_id] = (unreadMap[r.form_id] ?? 0) + 1
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Forms</h1>
        <a
          href="/coach/forms/new/edit"
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + New form
        </a>
      </div>

      <main className="w-full p-6 space-y-6">

        {/* Template picker */}
        <FormTemplates />

        {/* Paste import */}
        <PasteImport />

        {/* JotForm import */}
        <JotFormImport />

        {/* Divider */}
        {(forms ?? []).length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-gray-400 font-medium">Your forms</span>
            <div className="flex-1 border-t" />
          </div>
        )}

        {(!forms || forms.length === 0) && (
          <p className="text-sm text-gray-400 text-center py-4">No forms yet — use a template above or create from scratch.</p>
        )}

        {(forms ?? []).map((form) => (
          <div key={form.id} className="bg-white rounded-2xl border p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">{form.title}</p>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {TYPE_LABELS[form.type] ?? form.type}
                </span>
                {!form.is_active && (
                  <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">Inactive</span>
                )}
                {(unreadMap[form.id] ?? 0) > 0 && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold">
                    {unreadMap[form.id]} new
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Created {new Date(form.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <a
                href={`/coach/forms/${form.id}/responses`}
                className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Responses
              </a>
              <a
                href={`/coach/forms/${form.id}/edit`}
                className="text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Edit
              </a>
              <DeleteFormButton formId={form.id} />
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

