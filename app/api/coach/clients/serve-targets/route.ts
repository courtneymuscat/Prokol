import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { syncServeTargetsForClient } from '@/lib/serveTargetsSync'
import { NextResponse } from 'next/server'

// GET /api/coach/clients/serve-targets?clientId=xxx — self-healing: serve
// targets are meant to always exist alongside a daily target (the coach
// only controls whether the client can SEE them, via show_serve_targets —
// there's no "unset" state once a target exists). If this client has a
// resolvable daily target but no serve_targets row yet — true for every
// client who had a target configured before this sync existed, since the
// sync only runs on new target-setting events, not retroactively — compute
// and save it now rather than showing a confusing "no targets set" dead
// end that just points back at the same already-set target.
export async function GET(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  const supabase = await createClient()
  let { data } = await supabase
    .from('client_serve_targets')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .maybeSingle()

  if (!data) {
    const admin = createAdminClient()
    await syncServeTargetsForClient(admin, clientId, coachId)
    const retry = await supabase
      .from('client_serve_targets')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .maybeSingle()
    data = retry.data
  }

  return NextResponse.json({ targets: data ?? null })
}

// POST /api/coach/clients/serve-targets — upsert targets for a client
export async function POST(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { client_id, protein_serves, carb_serves, fat_serves, veg_unlimited, notes } = body

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_serve_targets')
    .upsert({
      client_id,
      coach_id: coachId,
      protein_serves: protein_serves ?? 0,
      carb_serves: carb_serves ?? 0,
      fat_serves: fat_serves ?? 0,
      // fruit_serves is deprecated (fruit is just carbs now, 20g = 1 serve
      // same as any other carb source) — always zeroed going forward so
      // it can't silently drift from carb_serves again.
      fruit_serves: 0,
      veg_unlimited: veg_unlimited ?? true,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ targets: data })
}

// No DELETE — serve targets are meant to always exist alongside a daily
// target (this GET route self-heals them back the moment they're missing),
// so "remove entirely" isn't a meaningful state any more. A coach who
// wants to not expose them to the client uses show_serve_targets instead
// (see app/api/coach/clients/[clientId]/settings/route.ts).
