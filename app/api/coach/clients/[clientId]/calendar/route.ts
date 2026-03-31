import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const start_date = searchParams.get('start_date')
  const end_date = searchParams.get('end_date')

  const supabase = await createClient()

  let eventsQuery = supabase
    .from('calendar_events')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (start_date) eventsQuery = eventsQuery.gte('event_date', start_date)
  if (end_date) eventsQuery = eventsQuery.lte('event_date', end_date)

  eventsQuery = eventsQuery.order('event_date', { ascending: true })

  const programsQuery = supabase
    .from('client_programs')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  const [eventsResult, programsResult] = await Promise.all([eventsQuery, programsQuery])

  return Response.json({
    events: eventsResult.data ?? [],
    programs: programsResult.data ?? [],
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { event_date, type, title, content } = body

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({ event_date, type, title, content, client_id: clientId, coach_id: coachId })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
