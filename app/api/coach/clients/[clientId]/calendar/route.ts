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
    .or(`coach_id.eq.${coachId},coach_id.is.null`)

  if (start_date) eventsQuery = eventsQuery.gte('event_date', start_date)
  if (end_date) eventsQuery = eventsQuery.lte('event_date', end_date)
  eventsQuery = eventsQuery.order('event_date', { ascending: true })

  let foodQuery = admin
    .from('food_logs')
    .select('log_date, calories, protein, carbs, fat')
    .eq('user_id', clientId)

  if (start_date) foodQuery = foodQuery.gte('log_date', start_date)
  if (end_date) foodQuery = foodQuery.lte('log_date', end_date)

  // ── Birthday backfill ─────────────────────────────────────────────────────
  // If the client has a DOB but no birthday calendar events yet (e.g. account
  // pre-dates the feature), create them now so the coach sees them immediately.
  const { data: clientProfile } = await admin
    .from('profiles')
    .select('date_of_birth, timezone')
    .eq('id', clientId)
    .single()

  const dob = (clientProfile as Record<string, unknown> | null)?.date_of_birth as string | null
  if (dob) {
    const today = new Date().toISOString().split('T')[0]
    const { count: futureBdayCount } = await admin
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('type', 'birthday')
      .gte('event_date', today)

    if (!futureBdayCount) {
      const [, bdayMonth, bdayDay] = dob.split('-').map(Number)
      const thisYear = new Date().getFullYear()
      await admin.from('calendar_events').insert(
        Array.from({ length: 3 }, (_, i) => thisYear + i).map((y) => ({
          event_date: `${y}-${String(bdayMonth).padStart(2, '0')}-${String(bdayDay).padStart(2, '0')}`,
          type: 'birthday',
          title: 'Birthday',
          content: {},
          client_id: clientId,
          coach_id: null,
        }))
      )
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const [eventsResult, programsResult, foodResult, habitsResult, activeFlowsResult] = await Promise.all([
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
    supabase
      .from('client_autoflows')
      .select('id')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .eq('status', 'active'),
  ])

  // Filter out autoflow calendar events for flows that are no longer active
  const activeFlowIds = new Set((activeFlowsResult.data ?? []).map((f: { id: string }) => f.id))
  const events = (eventsResult.data ?? []).filter((e: { type: string; content: Record<string, unknown> }) => {
    if (e.type !== 'autoflow') return true
    const flowId = e.content?.flow_id as string | undefined
    return flowId ? activeFlowIds.has(flowId) : false
  })

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

  const clientTimezone = (clientProfile as Record<string, unknown> | null)?.timezone as string | null ?? null

  return Response.json({
    events,
    programs: programsResult.data ?? [],
    foodByDate,
    habits: habitsResult.data ?? [],
    clientTimezone,
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
  const { event_date, type, title, content, repeat_rule } = body

  // No repeat — single event
  if (!repeat_rule) {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({ event_date, type, title, content, client_id: clientId, coach_id: coachId })
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json(data)
  }

  // Recurring — generate all dates and batch insert
  const recurrenceId = crypto.randomUUID()
  const dates: string[] = []
  const [y, m, d] = event_date.split('-').map(Number)
  let current = new Date(Date.UTC(y, m - 1, d))
  const limit = new Date(Date.UTC(y + 1, m - 1, d)) // 1 year from start

  while (current <= limit) {
    dates.push(current.toISOString().split('T')[0])
    if (repeat_rule === 'weekly') {
      current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 7))
    } else if (repeat_rule === 'biweekly') {
      current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 14))
    } else if (repeat_rule === 'monthly') {
      current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, current.getUTCDate()))
    } else {
      break
    }
  }

  const rows = dates.map((date) => ({
    event_date: date,
    type,
    title,
    content: { ...(content ?? {}), recurrence_id: recurrenceId, repeat_rule },
    client_id: clientId,
    coach_id: coachId,
  }))

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(rows)
    .select()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ events: data })
}
