import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('client_goals')
    .select('main_goal, mini_goals, updated_at')
    .eq('client_id', user.id)
    .maybeSingle()

  return Response.json(data ?? { main_goal: null, mini_goals: [] })
}

// Lets a client edit just their own main_goal. mini_goals/key_notes/
// medications stay coach-only (set via the coach-side PUT at
// app/api/coach/clients/[clientId]/goals/route.ts) — this only ever
// touches main_goal, read-modify-write so it never clobbers those.
// Uses the admin client because client_goals RLS only grants clients
// SELECT on their own row (coach has the only write policy) — safe here
// since the row being written is scoped to the caller's own session.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { main_goal } = await req.json()
  if (main_goal !== null && typeof main_goal !== 'string') {
    return Response.json({ error: 'main_goal must be a string or null' }, { status: 400 })
  }

  const { data: coachRel } = await supabase
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!coachRel) return Response.json({ error: 'No active coach relationship' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('client_goals')
    .select('mini_goals, key_notes')
    .eq('coach_id', coachRel.coach_id)
    .eq('client_id', user.id)
    .maybeSingle()

  const { data, error } = await admin
    .from('client_goals')
    .upsert(
      {
        coach_id: coachRel.coach_id,
        client_id: user.id,
        main_goal: (main_goal as string | null)?.trim() || null,
        mini_goals: existing?.mini_goals ?? [],
        key_notes: existing?.key_notes ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'coach_id,client_id' },
    )
    .select('main_goal, mini_goals')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
