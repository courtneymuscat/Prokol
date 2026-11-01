import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { syncServeTargetsForClient } from '@/lib/serveTargetsSync'
import { resolveEffectiveTarget } from '@/lib/effectiveTarget'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

async function verifyAccess(coachId: string, clientId: string) {
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
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('age, sex, height_cm, weight_kg, steps_per_day, activities, goal, adjustment_pct, tdee, target_calories, target_protein, target_carbs, target_fat')
    .eq('id', clientId)
    .single()

  // The calculator INPUTS (age/sex/height/weight/steps/activities/goal) and
  // its own TDEE OUTPUT always reflect the saved calculator state, as-is.
  // The daily TARGET fields, though, need to reflect whatever the client
  // actually currently sees — which is the meal plan's real totals, not
  // these saved-but-possibly-inactive profile fields, whenever
  // targets_source is 'meal_plan' (same resolution app/dashboard/page.tsx
  // already does for the client's own view). Without this, the coach's own
  // "Daily target — what the client sees" preview could show stale numbers
  // left over from before the client was switched onto a meal plan.
  const effective = await resolveEffectiveTarget(admin, clientId, coachId)
  const target = effective.calories > 0
    ? {
        target_calories: Math.round(effective.calories),
        target_protein: Math.round(effective.protein),
        target_carbs: Math.round(effective.carbs),
        target_fat: Math.round(effective.fat),
      }
    : {}

  return Response.json({ ...(data ?? {}), ...target })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()

  // Always save the TDEE calculation data
  const calcFields: Record<string, unknown> = {
    age:            body.age ?? null,
    sex:            body.sex ?? null,
    height_cm:      body.height_cm ?? null,
    weight_kg:      body.weight_kg ?? null,
    steps_per_day:  body.steps_per_day ?? null,
    activities:     body.activities ?? [],
    goal:           body.goal ?? null,
    adjustment_pct: body.adjustment_pct ?? null,
    tdee:           body.tdee ?? null,
  }

  // Only overwrite daily targets when explicitly requested (no active meal plan)
  if (body.apply_targets) {
    calcFields.target_calories = body.target_calories ?? null
    calcFields.target_protein  = body.target_protein  ?? null
    calcFields.target_carbs    = body.target_carbs    ?? null
    calcFields.target_fat      = body.target_fat      ?? null
  }

  const { error } = await admin.from('profiles').update(calcFields).eq('id', clientId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Auto-calculate and save serve targets whenever daily targets are
  // (re)set — removes the previous manual "Apply to serve targets" ->
  // "Save Targets" two-step dance a coach had to do separately. Re-resolves
  // the client's actual EFFECTIVE target rather than assuming these
  // just-saved TDEE numbers are it — if the client is still on
  // targets_source: 'meal_plan' (this instance of TDEESection doesn't flip
  // it back the way the Serve Guide tab's "Override daily targets" does),
  // serves stay synced to the meal plan they're actually seeing instead of
  // the saved-but-inactive TDEE numbers. See syncServeTargetsForClient.
  if (body.apply_targets) {
    await syncServeTargetsForClient(admin, clientId, coachId)
  }

  return Response.json({ ok: true })
}
