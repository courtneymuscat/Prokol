import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/foods/[id] — update serving info on a food. We don't know
// whether the row lives in the per-coach `foods` table or the global
// `food_database`, so we try the user-owned table first then fall back
// to the global one. RLS keeps coaches from updating anyone else's
// custom foods.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  if (body.serving_quantity !== undefined) {
    const n = Number(body.serving_quantity)
    updates.serving_quantity = Number.isFinite(n) && n > 0 ? n : null
  }
  if (body.serving_size !== undefined) {
    updates.serving_size = body.serving_size?.trim?.() || null
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Try the per-coach foods table first (only the owner can update,
  // enforced by RLS user_id = auth.uid()).
  const { data: own, error: ownErr } = await supabase
    .from('foods')
    .update(updates)
    .eq('id', id)
    .select('id, serving_quantity, serving_size')
    .maybeSingle()

  if (!ownErr && own) {
    return NextResponse.json({ food: own })
  }

  // Otherwise update the global food_database (any signed-in user can —
  // OFF data isn't authoritative and the most recent correction wins).
  const { data: global, error: globalErr } = await supabase
    .from('food_database')
    .update(updates)
    .eq('id', id)
    .select('id, serving_quantity, serving_size')
    .maybeSingle()

  if (globalErr) return NextResponse.json({ error: globalErr.message }, { status: 400 })
  return NextResponse.json({ food: global })
}
