import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { syncServeTargetsForClient } from '@/lib/serveTargetsSync'
import type { NextRequest } from 'next/server'

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('show_daily_targets, food_log_access, show_meal_builder, show_saved_meals, show_serve_targets, targets_source, targets_meal_plan_id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .single()

  const d = data as Record<string, unknown> | null
  return Response.json({
    show_daily_targets: d?.show_daily_targets ?? false,
    food_log_access: d?.food_log_access ?? 'full',
    show_meal_builder: d?.show_meal_builder ?? true,
    show_saved_meals: d?.show_saved_meals ?? true,
    show_serve_targets: d?.show_serve_targets ?? true,
    targets_source: d?.targets_source ?? 'tdee',
    targets_meal_plan_id: d?.targets_meal_plan_id ?? null,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { show_daily_targets, food_log_access, show_meal_builder, show_saved_meals, show_serve_targets, targets_source, targets_meal_plan_id } = body

  const validFoodLogAccess = ['full', 'no_scan', 'note_only', 'off']
  if (food_log_access !== undefined && !validFoodLogAccess.includes(food_log_access)) {
    return Response.json({ error: 'Invalid food_log_access value' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof show_daily_targets === 'boolean') update.show_daily_targets = show_daily_targets
  if (food_log_access !== undefined) update.food_log_access = food_log_access
  if (typeof show_meal_builder === 'boolean') update.show_meal_builder = show_meal_builder
  if (typeof show_saved_meals === 'boolean') update.show_saved_meals = show_saved_meals
  if (typeof show_serve_targets === 'boolean') update.show_serve_targets = show_serve_targets
  if (targets_source !== undefined) update.targets_source = targets_source
  if ('targets_meal_plan_id' in body) update.targets_meal_plan_id = targets_meal_plan_id ?? null

  const admin = createAdminClient()
  const { error } = await admin
    .from('coach_clients')
    .update(update)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Switching which source drives this client's daily target (or which
  // meal plan it's sourced from) changes what their effective target
  // resolves to — resync serves immediately rather than leaving them
  // reflecting whatever source was active before. See
  // syncServeTargetsForClient's comment for why this re-resolves fresh
  // instead of computing the new target inline here.
  //
  // We just wrote targets_source/targets_meal_plan_id above, so when the
  // request set both explicitly, pass them straight through instead of
  // having the sync immediately re-query the exact row this request just
  // updated — this is the save the coach is actively waiting on, so
  // skipping a redundant round trip here is worth it. Falls back to
  // querying fresh (unchanged behaviour) if only one of the two was sent.
  if (targets_source !== undefined || 'targets_meal_plan_id' in body) {
    const knownRel = targets_source !== undefined && 'targets_meal_plan_id' in body
      ? { targets_source: targets_source ?? 'tdee', targets_meal_plan_id: targets_meal_plan_id ?? null }
      : undefined
    await syncServeTargetsForClient(admin, clientId, coachId, knownRel)
  }

  return Response.json({ ok: true })
}
