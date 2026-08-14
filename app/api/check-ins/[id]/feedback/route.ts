import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  // Verify the check-in belongs to one of this coach's clients
  const { data: checkIn } = await supabase
    .from('check_ins')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!checkIn) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', checkIn.user_id)
    .in('status', ['active', 'archived'])
    .single()

  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { feedback, reviewed } = await req.json()

  const patch: Record<string, unknown> = {}
  if (typeof feedback === 'string') patch.coach_feedback = feedback.trim() || null
  if (typeof reviewed === 'boolean') {
    patch.reviewed_by_coach = reviewed
    patch.reviewed_at = reviewed ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('check_ins')
    .update(patch)
    .eq('id', id)
    .select('coach_feedback, reviewed_by_coach, reviewed_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
