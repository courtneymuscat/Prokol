import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

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

  // Preserve existing subscription_tier and full_name
  const { data: existing } = await admin
    .from('profiles')
    .select('subscription_tier, full_name')
    .eq('id', user.id)
    .single()

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
      subscription_tier:    existing?.subscription_tier ?? 'individual_free',
    }, { onConflict: 'id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
