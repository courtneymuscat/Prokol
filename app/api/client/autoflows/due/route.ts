import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: flows } = await supabase
    .from('client_autoflows')
    .select('id, name, start_date, template_id')
    .eq('client_id', user.id)
    .eq('status', 'active')
    .eq('show_as_checkin_prompt', true)

  if (!flows || flows.length === 0) return Response.json([])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const perFlow = await Promise.all(
    flows.map(async (flow) => {
      const startDate = new Date(flow.start_date + 'T00:00:00')

      const [{ data: steps }, { data: responses }] = await Promise.all([
        supabase
          .from('autoflow_template_steps')
          .select('step_number, title, day_offset')
          .eq('template_id', flow.template_id)
          .order('step_number'),
        supabase
          .from('autoflow_responses')
          .select('step_number')
          .eq('client_autoflow_id', flow.id)
          .eq('client_id', user.id),
      ])

      const respondedSteps = new Set((responses ?? []).map((r) => r.step_number))

      return (steps ?? [])
        .filter((step) => {
          const dueDate = new Date(startDate.getTime() + step.day_offset * 86400000)
          dueDate.setHours(0, 0, 0, 0)
          return dueDate <= today && !respondedSteps.has(step.step_number)
        })
        .map((step) => ({
          flow_id: flow.id,
          flow_name: flow.name,
          step_number: step.step_number,
          title: step.title,
          due_date: new Date(startDate.getTime() + step.day_offset * 86400000)
            .toISOString()
            .split('T')[0],
        }))
    })
  )

  return Response.json(perFlow.flat())
}
