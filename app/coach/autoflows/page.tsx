import { redirect } from 'next/navigation'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { fetchOrgTemplatesForCoach, getOrgForUser } from '@/lib/org'
import AutoflowPresets from './AutoflowPresets'
import AutoflowList from './AutoflowList'

type AutoflowRow = {
  id: string
  name: string
  description: string | null
  type: string | null
  total_steps: number | null
  created_at: string
}

export default async function CoachAutoflowsPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: templates }, orgTemplates, membership] = await Promise.all([
    supabase
      .from('autoflow_templates')
      .select('id, name, description, type, total_steps, created_at')
      .eq('coach_id', coachId)
      .eq('is_org_template', false)
      // Hide per-client forked templates (see lib/autoflow-fork)
      .eq('is_client_only', false)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    fetchOrgTemplatesForCoach<AutoflowRow>(
      coachId,
      'autoflow_templates',
      'id, name, description, type, total_steps, created_at',
    ),
    getOrgForUser(coachId),
  ])

  // Count actual steps rather than using the possibly-stale total_steps column.
  // Need step counts for both own and org templates.
  const allTemplateIds = [
    ...((templates ?? []) as AutoflowRow[]).map((t) => t.id),
    ...orgTemplates.map((t) => t.id),
  ]
  const { data: allSteps } = allTemplateIds.length
    ? await supabase.from('autoflow_template_steps').select('template_id').in('template_id', allTemplateIds)
    : { data: [] }
  const stepCountMap: Record<string, number> = {}
  for (const s of allSteps ?? []) stepCountMap[s.template_id] = (stepCountMap[s.template_id] ?? 0) + 1

  const templatesWithCount = ((templates ?? []) as AutoflowRow[]).map(t => ({
    ...t,
    type: t.type ?? 'weekly_checkin',
    total_steps: stepCountMap[t.id] ?? t.total_steps ?? 0,
  }))
  const orgTemplatesWithCount = orgTemplates.map(t => ({
    ...t,
    type: t.type ?? 'weekly_checkin',
    total_steps: stepCountMap[t.id] ?? t.total_steps ?? 0,
    is_org_template: true,
  }))

  const existingNames = (templates ?? []).map(t => t.name)
  const orgName = membership?.org_name ?? null

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Autoflows</h1>
          <p className="text-xs text-gray-500 mt-0.5">Automated check-in and onboarding sequences you can assign to clients</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/coach/autoflows/archived"
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            View archived
          </a>
          <a
            href="/coach/autoflows/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + New flow
          </a>
        </div>
      </div>

      <main className="w-full p-6 space-y-8">

        {/* Org templates */}
        {orgTemplatesWithCount.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Organisation flows</h2>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {orgName ? `From ${orgName}` : 'Org template'}
              </span>
            </div>
            <p className="text-xs text-gray-500 -mt-1">
              {membership?.role === 'owner' || membership?.role === 'admin'
                ? `Published to ${orgName ?? 'your organisation'}. Editing here updates the version every coach sees — your private flows below are unaffected.`
                : 'Shared with your organisation. View only — make a copy to customise without affecting other coaches.'}
            </p>
            <AutoflowList templates={orgTemplatesWithCount} />
          </div>
        )}

        {/* Your templates */}
        {templatesWithCount.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Your flows</h2>
            <p className="text-xs text-gray-500 -mt-1">
              {orgName
                ? `Private to you. Other coaches in ${orgName} can't see these unless you publish them.`
                : 'Private to you. Only your own clients can be assigned these flows.'}
            </p>
            <AutoflowList templates={templatesWithCount} />
          </div>
        )}

        {/* Preset templates */}
        <AutoflowPresets existingNames={existingNames} />

      </main>
    </div>
  )
}
