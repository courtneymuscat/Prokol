import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'

type Params = { clientId: string; planId: string }

// GET — full plan including phases
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  let { data, error } = await supabase
    .from('client_plans')
    .select('id, name, start_date, phases, is_visible_to_client, updated_at')
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  // Fallback if is_visible_to_client column doesn't exist yet
  if (error) {
    const fallback = await supabase
      .from('client_plans')
      .select('id, name, start_date, phases, updated_at')
      .eq('id', planId)
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .single()
    if (fallback.error || !fallback.data) return Response.json({ error: 'Not found' }, { status: 404 })
    data = { ...fallback.data, is_visible_to_client: false } as typeof data
    error = null
  }

  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

// PUT — update plan
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, start_date, phases, is_visible_to_client } = await req.json()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_plans')
    .update({
      name: name ?? 'Protocol',
      start_date: start_date ?? null,
      phases: phases ?? [],
      is_visible_to_client: is_visible_to_client ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .select('id, name, start_date, phases, is_visible_to_client')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

// DELETE — remove plan
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('client_plans')
    .delete()
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}

// POST — apply a week's macro targets to the client's live profile
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { phase } = await req.json()
  if (!phase) return Response.json({ error: 'phase required' }, { status: 400 })

  const admin = createAdminClient()

  let calories: number | null = phase.calorie_target ?? null
  if (!calories && phase.calorie_adjustment_pct != null) {
    const { data: profile } = await admin
      .from('profiles')
      .select('tdee')
      .eq('id', clientId)
      .single()
    const tdee = (profile as Record<string, unknown>)?.tdee as number | null
    if (tdee) calories = Math.round(tdee * (1 + phase.calorie_adjustment_pct / 100))
  }

  const updates: Record<string, unknown> = {}
  if (calories != null) updates.target_calories = calories
  if (phase.protein_g != null) updates.target_protein = phase.protein_g
  if (phase.carbs_g != null) updates.target_carbs = phase.carbs_g
  if (phase.fat_g != null) updates.target_fat = phase.fat_g

  if (Object.keys(updates).length === 0) return Response.json({ ok: true })

  const { error } = await admin.from('profiles').update(updates).eq('id', clientId)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
