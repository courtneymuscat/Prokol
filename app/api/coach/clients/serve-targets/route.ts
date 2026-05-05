import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { NextResponse } from 'next/server'

// GET /api/coach/clients/serve-targets?clientId=xxx
export async function GET(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('client_serve_targets')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  return NextResponse.json({ targets: data ?? null })
}

// POST /api/coach/clients/serve-targets — upsert targets for a client
export async function POST(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { client_id, protein_serves, carb_serves, fat_serves, fruit_serves, veg_unlimited, notes } = body

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_serve_targets')
    .upsert({
      client_id,
      coach_id: coachId,
      protein_serves: protein_serves ?? 0,
      carb_serves: carb_serves ?? 0,
      fat_serves: fat_serves ?? 0,
      fruit_serves: fruit_serves ?? 0,
      veg_unlimited: veg_unlimited ?? true,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ targets: data })
}

// DELETE /api/coach/clients/serve-targets?clientId=xxx
export async function DELETE(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('client_serve_targets')
    .delete()
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
