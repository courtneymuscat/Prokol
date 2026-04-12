import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch ALL active flows (not just show_as_checkin_prompt)
  const { data: flows } = await admin
    .from('client_autoflows')
    .select('id, name, start_date, template_id, show_as_checkin_prompt, coach_id')
    .eq('client_id', user.id)
    .eq('status', 'active')

  if (!flows || flows.length === 0) return Response.json([])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const perFlow = await Promise.all(
    flows.map(async (flow) => {
      const startDate = new Date(flow.start_date + 'T00:00:00')

      const [{ data: steps }, { data: responses }] = await Promise.all([
        admin
          .from('autoflow_template_steps')
          .select('step_number, title, day_offset, trigger_type, trigger_step_number, tasks, resource_ids, form_id')
          .eq('template_id', flow.template_id)
          .order('step_number'),
        admin
          .from('autoflow_responses')
          .select('step_number, answers')
          .eq('client_autoflow_id', flow.id)
          .eq('client_id', user.id),
      ])

      const responseMap: Record<number, Record<string, string>> = Object.fromEntries(
        (responses ?? []).map((r) => [r.step_number, (r.answers as Record<string, string>) ?? {}])
      )
      const respondedSteps = new Set(Object.keys(responseMap).map(Number))

      const dueSteps = (steps ?? []).filter((step) => {
        if (respondedSteps.has(step.step_number)) return false
        const triggerType = (step as Record<string, unknown>).trigger_type ?? 'day_offset'
        if (triggerType === 'on_step_complete') {
          const triggerStep = (step as Record<string, unknown>).trigger_step_number as number | null
          return triggerStep != null && respondedSteps.has(triggerStep)
        }
        const dueDate = new Date(startDate.getTime() + step.day_offset * 86400000)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate <= today
      })

      if (dueSteps.length === 0) return []

      // Collect all resource IDs across due steps
      const allResourceIds = dueSteps.flatMap((s) =>
        Array.isArray((s as Record<string, unknown>).resource_ids) ? (s as Record<string, unknown>).resource_ids as string[] : []
      )
      const allFormIds = dueSteps
        .map((s) => (s as Record<string, unknown>).form_id as string | null)
        .filter(Boolean) as string[]

      const flowCoachId = (flow as Record<string, unknown>).coach_id as string | null
      const [resourcesResult, formsResult] = await Promise.all([
        allResourceIds.length > 0
          ? (() => {
              const q = admin.from('coach_resources').select('id, name, type, url').in('id', allResourceIds)
              return flowCoachId ? q.eq('coach_id', flowCoachId) : q
            })()
          : Promise.resolve({ data: [] }),
        allFormIds.length > 0
          ? admin.from('forms').select('id, title').in('id', allFormIds)
          : Promise.resolve({ data: [] }),
      ])

      const resourceMap: Record<string, { id: string; name: string; type: string; url: string | null }> = Object.fromEntries(
        (resourcesResult.data ?? []).map((r) => [r.id, r])
      )
      const formMap: Record<string, { id: string; title: string }> = Object.fromEntries(
        (formsResult.data ?? []).map((f) => [f.id, f])
      )

      // Build a set of step_numbers that are triggered by on_step_complete from a due step
      const dueStepNumbers = new Set(dueSteps.map((s) => s.step_number))
      const allSteps = steps ?? []

      return dueSteps.map((step) => {
        const stepRecord = step as Record<string, unknown>
        const resourceIds = Array.isArray(stepRecord.resource_ids) ? stepRecord.resource_ids as string[] : []
        const formId = stepRecord.form_id as string | null
        const rawTasks = Array.isArray(stepRecord.tasks) ? stepRecord.tasks as Array<Record<string, unknown>> : []

        // Enrich tasks with completion status
        const existingAnswers = responseMap[step.step_number] ?? {}
        const tasks = rawTasks.map((t) => ({
          id: t.id as string,
          label: t.label as string,
          link_type: (t.link_type as string | null) ?? null,
          link_url: (t.link_url as string | null) ?? null,
          link_label: (t.link_label as string | null) ?? null,
          completed: existingAnswers[`task_${t.id}`] === 'done',
        }))

        // Check if completing this step unlocks another on_step_complete step
        const unlocks_next_step = allSteps.some((s) => {
          const r = s as Record<string, unknown>
          return (
            r.trigger_type === 'on_step_complete' &&
            r.trigger_step_number === step.step_number &&
            !respondedSteps.has(s.step_number) &&
            !dueStepNumbers.has(s.step_number)
          )
        })

        return {
          flow_id: flow.id,
          flow_name: flow.name,
          step_number: step.step_number,
          title: step.title,
          trigger_type: (stepRecord.trigger_type as string) ?? 'day_offset',
          due_date: (stepRecord.trigger_type as string) === 'on_step_complete'
            ? new Date().toISOString().split('T')[0]
            : new Date(startDate.getTime() + step.day_offset * 86400000).toISOString().split('T')[0],
          show_as_checkin_prompt: (flow as Record<string, unknown>).show_as_checkin_prompt as boolean ?? false,
          tasks,
          resources: resourceIds.map((id) => resourceMap[id]).filter(Boolean),
          linked_form: formId ? (formMap[formId] ?? null) : null,
          unlocks_next_step,
        }
      })
    })
  )

  return Response.json(perFlow.flat())
}
