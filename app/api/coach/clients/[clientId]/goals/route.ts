import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  let { data, error } = await supabase
    .from('client_goals')
    .select('main_goal, mini_goals, key_notes, medications, updated_at')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .maybeSingle()

  // Migration hasn't run yet — retry without the new column.
  if (error?.message?.includes('medications')) {
    const retry = await supabase
      .from('client_goals')
      .select('main_goal, mini_goals, key_notes, updated_at')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .maybeSingle()
    data = retry.data as typeof data
  }

  return Response.json(data ?? { main_goal: null, mini_goals: [], key_notes: [], medications: [] })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { main_goal, mini_goals, key_notes, medications } = await req.json()
  const supabase = await createClient()

  const baseRow = {
    coach_id: coachId,
    client_id: clientId,
    main_goal: main_goal ?? null,
    mini_goals: mini_goals ?? [],
    key_notes: key_notes ?? [],
    updated_at: new Date().toISOString(),
  }
  const fullRow = medications !== undefined ? { ...baseRow, medications } : baseRow

  let { data, error } = await supabase
    .from('client_goals')
    .upsert(fullRow, { onConflict: 'coach_id,client_id' })
    .select('main_goal, mini_goals, key_notes, medications, updated_at')
    .single()

  // Migration not yet applied — retry without medications so the rest still saves.
  if (error?.message?.includes('medications')) {
    const retry = await supabase
      .from('client_goals')
      .upsert(baseRow, { onConflict: 'coach_id,client_id' })
      .select('main_goal, mini_goals, key_notes, updated_at')
      .single()
    data = retry.data as typeof data
    error = retry.error
  }

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
