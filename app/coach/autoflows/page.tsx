import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import AutoflowPresets from './AutoflowPresets'

const TYPE_LABELS: Record<string, string> = {
  weekly_checkin: 'Weekly check-in',
  onboarding: 'Staged flow',
}

export default async function CoachAutoflowsPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('autoflow_templates')
    .select('id, name, description, type, total_steps, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  const existingNames = (templates ?? []).map(t => t.name)

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Autoflows</h1>
          <p className="text-xs text-gray-500 mt-0.5">Automated check-in and onboarding sequences you can assign to clients</p>
        </div>
        <a
          href="/coach/autoflows/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + New flow
        </a>
      </div>

      <main className="max-w-3xl mx-auto w-full p-6 space-y-8">

        {/* Your templates */}
        {templates && templates.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Your flows</h2>
            <div className="space-y-2">
              {templates.map(t => (
                <a
                  key={t.id}
                  href={`/coach/autoflows/${t.id}`}
                  className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between hover:border-gray-400 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[t.type] ?? t.type}
                      </span>
                      <span className="text-[11px] text-gray-400">{t.total_steps} steps</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Preset templates */}
        <AutoflowPresets existingNames={existingNames} />

      </main>
    </div>
  )
}
