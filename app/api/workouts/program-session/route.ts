import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyCoachOfClientLog } from '@/lib/coach-notifications'
import type { NextRequest } from 'next/server'

// POST /api/workouts/program-session
// Saves a client's workout result for a specific program day.
// Stores as a calendar_event so the coach can see it in their client calendar.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { program_id, week_index, day_index, event_date, day_name, program_name, sections, exercises } = body

  if (!program_id || week_index == null || day_index == null || !event_date) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up the coach_id from the client_programs table
  const { data: prog } = await admin
    .from('client_programs')
    .select('coach_id')
    .eq('id', program_id)
    .eq('client_id', user.id)
    .single()

  const coach_id = prog?.coach_id ?? null

  // Check if a result already exists for this program day (ignoring event_date — handles moved workouts)
  const { data: existing } = await admin
    .from('calendar_events')
    .select('id')
    .eq('client_id', user.id)
    .eq('type', 'program_workout_result')
    .contains('content', { program_id, week_index, day_index })
    .maybeSingle()

  const content = {
    program_id,
    program_name,
    week_index,
    day_index,
    day_name,
    sections: sections ?? [],
    exercises: exercises ?? [],
    completed_at: new Date().toISOString(),
  }

  if (existing) {
    // Update existing result — no notification, the coach was already pinged
    // when the workout was first logged.
    const { data, error } = await admin
      .from('calendar_events')
      .update({ content, title: day_name })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json(data)
  }

  // Insert new result
  const { data, error } = await admin
    .from('calendar_events')
    .insert({
      type: 'program_workout_result',
      title: day_name,
      event_date,
      client_id: user.id,
      coach_id,
      content,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })

  notifyCoachOfClientLog(user.id, 'workout').catch(() => {})

  return Response.json(data)
}
