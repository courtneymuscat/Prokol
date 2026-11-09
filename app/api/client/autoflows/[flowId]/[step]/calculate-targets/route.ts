import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncServeTargetsForClient } from '@/lib/serveTargetsSync'
import { mapDietaryPreferenceToMealPlanGoal, pickBestMealPlan } from '@/lib/autoAssignNutrition'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ flowId: string; step: string }> }

// Client-initiated version of the coach's own TDEE card
// (app/api/coach/clients/[clientId]/tdee/route.ts) — the client computes
// their result client-side with lib/tdee.ts and posts the finished
// numbers here, same trust model as that route and as onboarding's
// completion endpoint (the client is setting their OWN targets, not
// someone else's). Unlike the coach route, there's no separate
// "apply_targets" flag — running this calculator from inside a step IS
// the apply action.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { flowId, step } = await params
  const stepNum = parseInt(step)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: flow } = await admin
    .from('client_autoflows')
    .select('id, coach_id, template_id')
    .eq('id', flowId)
    .eq('client_id', user.id)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })
  const coachId = flow.coach_id as string

  const { data: templateStep } = await admin
    .from('autoflow_template_steps')
    .select('target_calc')
    .eq('template_id', flow.template_id)
    .eq('step_number', stepNum)
    .maybeSingle()
  if (!templateStep?.target_calc) return Response.json({ error: 'No calculator on this step' }, { status: 400 })

  const body = await req.json()
  const {
    first_name, phone, age, sex, height_cm, weight_kg, steps_per_day, activities, goal, adjustment_pct, dietary_preference,
    tdee, target_calories, target_protein, target_carbs, target_fat,
  } = body

  if (!target_calories || !target_protein || !target_carbs || !target_fat) {
    return Response.json({ error: 'Missing calculated targets' }, { status: 400 })
  }

  // This calculator is the only "onboarding" some signup-link clients ever
  // see (no coach sets their profile manually) — so completing it has to
  // fully substitute for /onboarding, not just set targets. Seeds full_name
  // from first_name the same way /api/onboarding/complete does, without
  // overwriting one the client already has.
  const { data: existingProfile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      first_name: first_name ?? null,
      full_name: existingProfile?.full_name ?? (first_name ? String(first_name).trim() : null),
      phone: phone ?? null,
      onboarding_completed: true,
      age: age ?? null,
      sex: sex ?? null,
      height_cm: height_cm ?? null,
      weight_kg: weight_kg ?? null,
      steps_per_day: steps_per_day ?? null,
      activities: activities ?? [],
      goal: goal ?? null,
      adjustment_pct: adjustment_pct ?? null,
      dietary_preference: dietary_preference ?? null,
      tdee: tdee ?? null,
      target_calories,
      target_protein,
      target_carbs,
      target_fat,
    })
    .eq('id', user.id)
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 })

  // The calculated target is the authoritative source from here — a
  // meal plan assigned below is a starting point to follow, not a
  // target override (same split as onboarding's auto-setup).
  await admin
    .from('coach_clients')
    .update({ targets_source: 'tdee', targets_meal_plan_id: null })
    .eq('coach_id', coachId)
    .eq('client_id', user.id)

  await syncServeTargetsForClient(admin, user.id, coachId)

  // Only auto-assign a meal plan if the client doesn't already have an
  // active one — never clobber an existing plan the client is already
  // following.
  const { data: existingInstance } = await admin
    .from('autoflow_step_nutrition_instances')
    .select('client_meal_plan_id')
    .eq('client_autoflow_id', flowId)
    .eq('step_number', stepNum)
    .maybeSingle()

  let assignedPlanId: string | null = existingInstance?.client_meal_plan_id ?? null
  let assignedPlanName: string | null = null

  if (!assignedPlanId) {
    const { data: existingActivePlan } = await admin
      .from('client_meal_plans')
      .select('id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!existingActivePlan) {
      const dietGoal = mapDietaryPreferenceToMealPlanGoal(dietary_preference ?? null)

      const { data: candidates } = await admin
        .from('meal_plans')
        .select('id, name, goal, total_calories, content')
        .eq('coach_id', coachId)
        .eq('is_generic', true)
        .is('archived_at', null)

      const best = pickBestMealPlan(candidates ?? [], target_calories, dietGoal)
      if (best) {
        const { data: newPlan } = await admin
          .from('client_meal_plans')
          .insert({
            meal_plan_id: best.id,
            name: best.name,
            content: best.content,
            start_date: new Date().toISOString().slice(0, 10),
            total_calories: best.total_calories,
            client_id: user.id,
            coach_id: coachId,
            status: 'active',
          })
          .select('id, name')
          .single()
        // Deliberately not syncing profiles.target_* from this plan's own
        // totals — the TDEE calc just saved above is the authoritative,
        // personalised target; this plan is a best-fit starting point the
        // client can swap/adjust, not a target override.
        if (newPlan) {
          assignedPlanId = newPlan.id as string
          assignedPlanName = newPlan.name as string
        }
      }
    }
  } else {
    const { data: plan } = await admin
      .from('client_meal_plans')
      .select('name')
      .eq('id', assignedPlanId)
      .maybeSingle()
    assignedPlanName = plan?.name ?? null
  }

  await admin
    .from('autoflow_step_nutrition_instances')
    .upsert(
      {
        client_autoflow_id: flowId,
        step_number: stepNum,
        client_id: user.id,
        client_meal_plan_id: assignedPlanId,
        target_calories,
        target_protein,
        target_carbs,
        target_fat,
      },
      { onConflict: 'client_autoflow_id,step_number' },
    )

  return Response.json({
    ok: true,
    result: { target_calories, target_protein, target_carbs, target_fat, assigned_plan_name: assignedPlanName },
  })
}
