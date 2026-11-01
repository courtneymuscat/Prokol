import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { syncServeTargetsForClient } from '@/lib/serveTargetsSync'
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

  return Response.json(data ?? {})
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
