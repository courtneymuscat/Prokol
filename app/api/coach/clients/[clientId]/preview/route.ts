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
    .in('status', ['active', 'archived', 'pending_invite'])
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
    coachBrandingResult,
    coachRelResult,
    goalsResult,
    mealPlansResult,
    habitsResult,
    schedulesResult,
    autoflowsResult,
    supplementsResult,
    protocolResult,
    serveTargetsResult,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('full_name, sex, target_calories, target_protein, target_carbs, target_fat')
      .eq('id', clientId)
      .single(),

    // Coach branding — shown in the preview nav
    admin
      .from('profiles')
      .select('brand_colour, logo_url, brand_name')
      .eq('id', coachId)
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
      .select('id, name, status, content, total_calories')
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

    // Supplements assigned to client
    admin
      .from('client_supplements')
      .select('id, name, dosage')
      .eq('client_id', clientId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    // Protocol sections assigned to client
    admin
      .from('client_protocol')
      .select('sections')
      .eq('client_id', clientId)
      .maybeSingle(),

    // Serve targets — whether the Food Cheat Sheet is visible to client
    admin
      .from('client_serve_targets')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle(),
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
            .select('step_number, title, day_offset, trigger_type, trigger_step_number')
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
            if (responded.has(s.step_number)) return false
            const triggerType = (s as Record<string, unknown>).trigger_type ?? 'day_offset'
            if (triggerType === 'on_step_complete') {
              const triggerStep = (s as Record<string, unknown>).trigger_step_number as number | null
              return triggerStep != null && responded.has(triggerStep)
            }
            const due = new Date(startDate.getTime() + s.day_offset * 86400000)
            due.setHours(0, 0, 0, 0)
            return due <= today
          })
          .map((s) => ({ flow_id: flow.id, flow_name: flow.name, step_number: s.step_number, title: s.title }))
      })
    )
    dueAutoflowSteps.push(...perFlow.flat())
  }

  const brandingRaw = coachBrandingResult.data as Record<string, unknown> | null
  return Response.json({
    branding: {
      brand_colour: (brandingRaw?.brand_colour as string | null) ?? null,
      logo_url:     (brandingRaw?.logo_url as string | null) ?? null,
      brand_name:   (brandingRaw?.brand_name as string | null) ?? null,
    },
    profile: profileResult.data ? { ...profileResult.data, sex: (profileResult.data as Record<string, unknown>).sex as string | null ?? null } : null,
    show_daily_targets: coachRelResult.data?.show_daily_targets ?? true,
    goals: goalsResult.data ?? { main_goal: null, mini_goals: [], key_notes: [] },
    meal_plans: (mealPlansResult.data ?? []).map((plan) => {
      type MealFood = { calories?: number; protein?: number; carbs?: number; fat?: number }
      type MealSlot = { foods?: MealFood[] }
      let cal = 0, pro = 0, carb = 0, fat = 0
      for (const slot of (Array.isArray(plan.content) ? plan.content : []) as MealSlot[]) {
        for (const food of (Array.isArray(slot?.foods) ? slot.foods : []) as MealFood[]) {
          cal  += Number(food?.calories) || 0
          pro  += Number(food?.protein)  || 0
          carb += Number(food?.carbs)    || 0
          fat  += Number(food?.fat)      || 0
        }
      }
      return {
        id: plan.id,
        name: plan.name,
        target_calories: cal > 0 ? Math.round(cal) : ((plan as Record<string, unknown>).total_calories as number | null) ?? null,
        target_protein:  pro  > 0 ? Math.round(pro)  : null,
        target_carbs:    carb > 0 ? Math.round(carb) : null,
        target_fat:      fat  > 0 ? Math.round(fat)  : null,
      }
    }),
    habits: habitsResult.data ?? [],
    checkin_schedules: schedulesResult.data ?? [],
    due_autoflow_steps: dueAutoflowSteps,
    supplements: supplementsResult.data ?? [],
    protocol: (protocolResult.data?.sections as { id: string; title: string; content: string }[] | null) ?? [],
    has_serve_targets: !!serveTargetsResult.data,
  })
}
