import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; responseId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { clientId, responseId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived'])
    .single()

  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if ('reviewed_by_coach' in body) patch.reviewed_by_coach = body.reviewed_by_coach
  if ('coach_feedback' in body) patch.coach_feedback = body.coach_feedback
  const admin = createAdminClient()
  const { error } = await admin
    .from('autoflow_responses')
    .update(patch)
    .eq('id', responseId)
    .eq('client_id', clientId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { clientId, responseId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived'])
    .single()

  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: resp } = await admin
    .from('autoflow_responses')
    .select('id, client_id')
    .eq('id', responseId)
    .eq('client_id', clientId)
    .single()

  if (!resp) return Response.json({ error: 'Not found' }, { status: 404 })

  const { error } = await admin.from('autoflow_responses').delete().eq('id', responseId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
