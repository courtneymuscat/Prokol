import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const admin = createAdminClient()

  let eventsQuery = supabase
    .from('calendar_events')
    .select('*')
    .eq('client_id', clientId)
    .or(`coach_id.eq.${coachId},and(type.eq.program_workout_result,coach_id.is.null)`)

  if (start_date) eventsQuery = eventsQuery.gte('event_date', start_date)
  if (end_date) eventsQuery = eventsQuery.lte('event_date', end_date)
  eventsQuery = eventsQuery.order('event_date', { ascending: true })

  let foodQuery = admin
    .from('food_logs')
    .select('log_date, calories, protein, carbs, fat')
    .eq('user_id', clientId)

  if (start_date) foodQuery = foodQuery.gte('log_date', start_date)
  if (end_date) foodQuery = foodQuery.lte('log_date', end_date)

  const [eventsResult, programsResult, foodResult, habitsResult] = await Promise.all([
    eventsQuery,
    supabase
      .from('client_programs')
      .select('id, name, start_date, content, status')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .in('status', ['active', 'completed']),
    foodQuery,
    supabase
      .from('habits')
      .select('id, name, type, target, unit, icon')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: true }),
  ])

  // Aggregate food logs by date
  const foodByDate: Record<string, { cal: number; protein: number; carbs: number; fat: number }> = {}
  for (const row of foodResult.data ?? []) {
    const d = foodByDate[row.log_date] ?? { cal: 0, protein: 0, carbs: 0, fat: 0 }
    d.cal += row.calories ?? 0
    d.protein += row.protein ?? 0
    d.carbs += row.carbs ?? 0
    d.fat += row.fat ?? 0
    foodByDate[row.log_date] = d
  }

  return Response.json({
    events: eventsResult.data ?? [],
    programs: programsResult.data ?? [],
    foodByDate,
    habits: habitsResult.data ?? [],
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
