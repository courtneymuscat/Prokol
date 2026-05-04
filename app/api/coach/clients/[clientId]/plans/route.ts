import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'

// GET — list all plans for this client (summaries, no phases)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_plans')
    .select('id, name, start_date, updated_at, is_visible_to_client')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .order('updated_at', { ascending: true })

  if (error) {
    // Fallback: select without is_visible_to_client in case migration hasn't been run
    const { data: fallback } = await supabase
      .from('client_plans')
      .select('id, name, start_date, updated_at')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .order('updated_at', { ascending: true })
    return Response.json((fallback ?? []).map(p => ({ ...p, is_visible_to_client: false })))
  }

  return Response.json(data ?? [])
}

// POST — create a new plan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim() || 'New Protocol'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_plans')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      name,
      start_date: null,
      phases: [],
      is_visible_to_client: false,
    })
    .select('id, name, start_date, is_visible_to_client, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
