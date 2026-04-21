import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import AutoflowPresets from './AutoflowPresets'
import AutoflowList from './AutoflowList'

export default async function CoachAutoflowsPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('autoflow_templates')
    .select('id, name, description, type, total_steps, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  // Count actual steps rather than using the possibly-stale total_steps column
  const templateIds = (templates ?? []).map(t => t.id)
  const { data: allSteps } = templateIds.length
    ? await supabase.from('autoflow_template_steps').select('template_id').in('template_id', templateIds)
    : { data: [] }
  const stepCountMap: Record<string, number> = {}
  for (const s of allSteps ?? []) stepCountMap[s.template_id] = (stepCountMap[s.template_id] ?? 0) + 1
  const templatesWithCount = (templates ?? []).map(t => ({ ...t, total_steps: stepCountMap[t.id] ?? t.total_steps }))

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
        {templatesWithCount.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Your flows</h2>
            <AutoflowList templates={templatesWithCount} />
          </div>
        )}

        {/* Preset templates */}
        <AutoflowPresets existingNames={existingNames} />

      </main>
    </div>
  )
}
