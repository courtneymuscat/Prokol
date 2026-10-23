import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { mapDietaryPreferenceToMealPlanGoal, pickBestMealPlan, macrosToServes } from '@/lib/autoAssignNutrition'
import type { NextRequest } from 'next/server'

// Auto-setup for signup-link clients only (gym members, or someone who
// bought a program directly from Court — see lib/coach.ts's
// acceptOrgSignupLink). A 1:1 invited client's onboarding_completed is
// already true the moment they accept their invite (acceptInvite sets it
// immediately, since a real coach is expected to set targets manually), so
// they never organically reach this route with an active coach_clients row
// still in place for the first time — by construction, only signup-link
// clients do. No extra flag needed to distinguish the two cases.
async function autoSetupForSignupLinkClient(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  coachId: string,
  macros: { target_protein: number | null; target_carbs: number | null; target_fat: number | null; target_calories: number | null },
  dietaryPreference: string | null,
) {
  // Serve targets — only if not already set, so this never clobbers a
  // coach's own manual work (client_id is unique on this table).
  const { data: existingTargets } = await admin
    .from('client_serve_targets')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle()

  if (!existingTargets && macros.target_protein != null && macros.target_carbs != null && macros.target_fat != null) {
    const serves = macrosToServes({
      proteinG: macros.target_protein,
      carbG: macros.target_carbs,
      fatG: macros.target_fat,
    })
    await admin.from('client_serve_targets').insert({
      client_id: clientId,
      coach_id: coachId,
      protein_serves: serves.protein_serves,
      carb_serves: serves.carb_serves,
      fat_serves: serves.fat_serves,
      fruit_serves: serves.fruit_serves,
      veg_unlimited: serves.veg_unlimited,
    })
  }

  // Meal plan — only if they don't already have an active one.
  const { data: existingPlan } = await admin
    .from('client_meal_plans')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()

  if (!existingPlan && macros.target_calories) {
    const dietGoal = mapDietaryPreferenceToMealPlanGoal(dietaryPreference)
    const { data: candidates } = await admin
      .from('meal_plans')
      .select('id, name, goal, total_calories, content')
      .eq('coach_id', coachId)
      .is('archived_at', null)

    const best = pickBestMealPlan(candidates ?? [], macros.target_calories, dietGoal)
    if (best) {
      await admin.from('client_meal_plans').insert({
        meal_plan_id: best.id,
        name: best.name,
        content: best.content,
        start_date: new Date().toISOString().slice(0, 10),
        total_calories: best.total_calories,
        client_id: clientId,
        coach_id: coachId,
        status: 'active',
      })
      // Deliberately not syncing profiles.target_* from this plan's own
      // totals (unlike the coach-manual-assign route) — the TDEE calc that
      // just ran moments earlier in this same request is the authoritative,
      // personalised target; this plan is a best-fit starting point the
      // client can swap/adjust, not a target override.
    }
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  // Use getUser() — verifies against auth.users, not just cookie cache
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const {
    goal, first_name, age, sex, height_cm, weight_kg,
    dietary_preference, steps_per_day, activities,
    tdee, target_calories, target_protein, target_carbs, target_fat,
    adjustment_pct,
  } = await req.json()

  if (!goal) return Response.json({ error: 'Goal is required' }, { status: 400 })

  const admin = createAdminClient()

  // Preserve existing subscription_tier and full_name; upgrade to 'coached' if they have a coach
  const [{ data: existing }, { data: coachRel }] = await Promise.all([
    admin.from('profiles').select('subscription_tier, full_name').eq('id', user.id).single(),
    admin.from('coach_clients').select('id, coach_id, status').eq('client_id', user.id).in('status', ['active', 'pending_invite']).maybeSingle(),
  ])

  const resolvedTier = coachRel
    ? 'coached'
    : (existing?.subscription_tier ?? 'individual_free')

  const { error } = await admin
    .from('profiles')
    .upsert({
      id:                   user.id,
      goal,
      first_name:           first_name ?? null,
      // Seed full_name from first_name if not already set (coach display uses full_name)
      full_name:            (existing as Record<string, unknown>)?.full_name ?? (first_name ? first_name.trim() : null),
      age:                  age ?? null,
      sex:                  sex ?? null,
      height_cm:            height_cm ?? null,
      weight_kg:            weight_kg ?? null,
      dietary_preference:   dietary_preference ?? null,
      steps_per_day:        steps_per_day ?? null,
      activities:           activities ?? [],
      tdee:                 tdee ?? null,
      target_calories:      target_calories ?? null,
      target_protein:       target_protein ?? null,
      target_carbs:         target_carbs ?? null,
      target_fat:           target_fat ?? null,
      adjustment_pct:       adjustment_pct ?? null,
      onboarding_completed: true,
      subscription_tier:    resolvedTier,
    }, { onConflict: 'id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (coachRel?.status === 'active' && coachRel.coach_id) {
    try {
      await autoSetupForSignupLinkClient(
        admin,
        user.id,
        coachRel.coach_id as string,
        { target_protein: target_protein ?? null, target_carbs: target_carbs ?? null, target_fat: target_fat ?? null, target_calories: target_calories ?? null },
        dietary_preference ?? null,
      )
    } catch (err) {
      // Never block onboarding completion over this — it's a helpful
      // default, not a required step.
      console.error('autoSetupForSignupLinkClient error:', err instanceof Error ? err.message : String(err))
    }
  }

  return Response.json({ ok: true })
}
