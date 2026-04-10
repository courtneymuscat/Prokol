import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

async function verifyAccess(coachId: string, clientId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived'])
    .single()
  return !!data
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    profileResult,
    coachRelResult,
    goalsResult,
    mealPlansResult,
    habitsResult,
    schedulesResult,
    autoflowsResult,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('full_name, target_calories, target_protein, target_carbs, target_fat')
      .eq('id', clientId)
      .single(),

    supabase
      .from('coach_clients')
      .select('show_daily_targets')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .single(),

    admin
      .from('client_goals')
      .select('main_goal, mini_goals, key_notes')
      .eq('client_id', clientId)
      .maybeSingle(),

    admin
      .from('client_meal_plans')
      .select('id, name, status')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),

    admin
      .from('habits')
      .select('id, name, icon, target, unit')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('name'),

    admin
      .from('checkin_schedules')
      .select('id, title, repeat_type, day_of_week, is_active')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),

    admin
      .from('client_autoflows')
      .select('id, name, start_date, template_id, show_as_checkin_prompt')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .eq('show_as_checkin_prompt', true),
  ])

  // Compute due autoflow steps
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueAutoflowSteps: { flow_id: string; flow_name: string; step_number: number; title: string }[] = []

  if (autoflowsResult.data?.length) {
    const perFlow = await Promise.all(
      autoflowsResult.data.map(async (flow) => {
        const startDate = new Date(flow.start_date + 'T00:00:00')
        const [{ data: steps }, { data: responses }] = await Promise.all([
          admin
            .from('autoflow_template_steps')
            .select('step_number, title, day_offset')
            .eq('template_id', flow.template_id)
            .order('step_number'),
          admin
            .from('autoflow_responses')
            .select('step_number')
            .eq('client_autoflow_id', flow.id)
            .eq('client_id', clientId),
        ])
        const responded = new Set((responses ?? []).map((r) => r.step_number))
        return (steps ?? [])
          .filter((s) => {
            const due = new Date(startDate.getTime() + s.day_offset * 86400000)
            due.setHours(0, 0, 0, 0)
            return due <= today && !responded.has(s.step_number)
          })
          .map((s) => ({ flow_id: flow.id, flow_name: flow.name, step_number: s.step_number, title: s.title }))
      })
    )
    dueAutoflowSteps.push(...perFlow.flat())
  }

  return Response.json({
    profile: profileResult.data ?? null,
    show_daily_targets: coachRelResult.data?.show_daily_targets ?? true,
    goals: goalsResult.data ?? { main_goal: null, mini_goals: [], key_notes: [] },
    meal_plans: mealPlansResult.data ?? [],
    habits: habitsResult.data ?? [],
    checkin_schedules: schedulesResult.data ?? [],
    due_autoflow_steps: dueAutoflowSteps,
  })
}
