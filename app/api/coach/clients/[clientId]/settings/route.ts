import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

async function verifyAccess(coachId: string, clientId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived'])
    .single()
  return !!data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('show_daily_targets')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .single()

  return Response.json({ show_daily_targets: data?.show_daily_targets ?? true })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyAccess(coachId, clientId))) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { show_daily_targets } = await req.json()
  if (typeof show_daily_targets !== 'boolean') {
    return Response.json({ error: 'show_daily_targets must be a boolean' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('coach_clients')
    .update({ show_daily_targets })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
