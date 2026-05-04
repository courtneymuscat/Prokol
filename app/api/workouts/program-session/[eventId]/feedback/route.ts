import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { sendPushToUser } from '@/lib/push'
import type { NextRequest } from 'next/server'

type FeedbackItem = { id: string; coachNote: string }

// PATCH /api/workouts/program-session/[eventId]/feedback
// Coach adds feedback notes to exercises/sections in a workout result.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { exerciseFeedback, sectionFeedback } = await req.json() as {
    exerciseFeedback?: FeedbackItem[]
    sectionFeedback?: FeedbackItem[]
  }

  const admin = createAdminClient()

  // Fetch event without coach_id filter — the coach_id column may be null
  // if the event was updated (not inserted) by the program-session route.
  const { data: event, error: fetchErr } = await admin
    .from('calendar_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (fetchErr || !event) return Response.json({ error: 'Not found' }, { status: 404 })

  // Verify this coach manages the client who owns the event
  const clientId = event.client_id as string | null
  if (!clientId) return Response.json({ error: 'Event has no client' }, { status: 400 })

  const { data: rel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()

  if (!rel) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const content = event.content as Record<string, unknown>
  const exercises = (content.exercises ?? []) as Array<Record<string, unknown>>
  const sections  = (content.sections  ?? []) as Array<Record<string, unknown>>

  const updatedExercises = exercises.map((ex) => {
    const fb = exerciseFeedback?.find((f) => f.id === ex.id)
    return fb !== undefined ? { ...ex, coachNote: fb.coachNote } : ex
  })

  const updatedSections = sections.map((sec) => {
    const fb = sectionFeedback?.find((f) => f.id === sec.id)
    return fb !== undefined ? { ...sec, coachNote: fb.coachNote } : sec
  })

  const { data, error } = await admin
    .from('calendar_events')
    .update({
      coach_id: coachId, // ensure it's set for future queries
      content: {
        ...content,
        exercises: updatedExercises,
        sections: updatedSections,
        feedback_left_at: new Date().toISOString(),
        feedback_seen: false,
      },
    })
    .eq('id', eventId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Push notification to client
  const dayName = (content.day_name as string | undefined) ?? 'your workout'
  sendPushToUser(clientId, {
    title: 'Coach left you feedback',
    body: `Your coach left feedback on ${dayName}`,
    url: `/calendar?event=${eventId}`,
    icon: '/icons/icon-192.png',
    tag: `workout-feedback-${eventId}`,
  }).catch(() => {/* silent */})

  return Response.json(data)
}
