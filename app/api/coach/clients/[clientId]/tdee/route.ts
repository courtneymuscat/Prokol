import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { targetMacrosToServes } from '@/lib/autoAssignNutrition'
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
  // "Save Targets" two-step dance a coach had to do separately, and keeps
  // the Food Cheat Sheet's serve counts reconciled with the exact same
  // equation that produced these targets (see targetMacrosToServes).
  // Preserves any notes the coach already wrote; always overwrites the
  // serve counts themselves, same as this endpoint already does for
  // target_calories/protein/carbs/fat above.
  if (body.apply_targets && calcFields.target_protein != null && calcFields.target_fat != null && calcFields.target_calories != null) {
    const serves = targetMacrosToServes({
      proteinG: calcFields.target_protein as number,
      fatG: calcFields.target_fat as number,
      targetCals: calcFields.target_calories as number,
    })
    const { data: existing } = await admin
      .from('client_serve_targets')
      .select('notes')
      .eq('client_id', clientId)
      .maybeSingle()
    await admin.from('client_serve_targets').upsert({
      client_id: clientId,
      coach_id: coachId,
      protein_serves: serves.protein_serves,
      carb_serves: serves.carb_serves,
      fat_serves: serves.fat_serves,
      fruit_serves: 0,
      veg_unlimited: serves.veg_unlimited,
      notes: existing?.notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
  }

  return Response.json({ ok: true })
}
