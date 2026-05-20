import { createClient } from '@/lib/supabase/server'
import { notifyCoachOfClientLog, type CoachNotifyEvent } from '@/lib/coach-notifications'
import type { NextRequest } from 'next/server'

const VALID_EVENTS = new Set<CoachNotifyEvent>([
  'food', 'weight', 'cycle', 'workout', 'habit', 'photo',
])

/**
 * Lightweight fire-and-forget endpoint clients call after a successful log to
 * let their coach know. The server resolves the calling user from the session
 * — clients can only notify on behalf of themselves, never another user.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ ok: false }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { event?: unknown }
  const event = body.event
  if (typeof event !== 'string' || !VALID_EVENTS.has(event as CoachNotifyEvent)) {
    return Response.json({ ok: false }, { status: 400 })
  }

  // Don't await — the caller doesn't need to wait for the push to fan out.
  notifyCoachOfClientLog(user.id, event as CoachNotifyEvent).catch(() => {})

  return Response.json({ ok: true })
}
