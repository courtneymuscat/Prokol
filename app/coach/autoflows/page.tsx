import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'

const TYPE_LABELS: Record<string, string> = {
  weekly_checkin: 'Weekly check-in',
  onboarding: 'Onboarding',
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

      <main className="max-w-3xl mx-auto w-full p-6 space-y-4">
        {/* Ideas banner */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Flow ideas</h2>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            {[
              '12-week progressive check-in',
              'New client onboarding (day 0, 3, 7, 14)',
              'Monthly body composition review',
              'Post-consultation follow-up',
              'Plateau protocol (2+ week stall)',
              'Pre/post holiday eating plan',
              'Habit-building phase (weeks 1–6)',
              'Goal reset + quarterly review',
            ].map(idea => (
              <div key={idea} className="flex items-center gap-2">
                <span className="w-1 h-1 bg-gray-300 rounded-full flex-shrink-0" />
                {idea}
              </div>
            ))}
          </div>
        </div>

        {/* Template list */}
        {!templates || templates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">No autoflows yet.</p>
            <a
              href="/coach/autoflows/new"
              className="inline-block mt-3 text-sm font-semibold text-gray-700 underline underline-offset-2"
            >
              Create your first flow →
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <a
                key={t.id}
                href={`/coach/autoflows/${t.id}`}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between hover:border-gray-400 transition-colors group"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">{t.name}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
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
        )}
      </main>
    </div>
  )
}
