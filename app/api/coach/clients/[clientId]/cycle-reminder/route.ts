import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()
  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await admin
    .from('profiles')
    .select('sex, cycle_reminders')
    .eq('id', clientId)
    .single()

  return Response.json({
    sex: profile?.sex ?? null,
    cycle_reminders: profile?.cycle_reminders !== false,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: rel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()
  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { enabled } = await req.json()

  const { error } = await admin
    .from('profiles')
    .update({ cycle_reminders: enabled })
    .eq('id', clientId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
