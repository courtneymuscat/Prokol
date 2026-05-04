import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

// GET /api/coach/clients/[clientId]/cycle-logs?limit=90
export async function GET(
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
    .in('status', ['active', 'archived', 'pending_invite'])
    .single()
  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '180'), 365)

  const { data, error } = await admin
    .from('cycle_logs')
    .select('log_date, period, flow, clots, blood_color, spotting, cervical_mucus, cervix_position, bbt, symptoms, mittelschmerz, pain_side, mood, energy, sleep, libido, digestion, notes')
    .eq('user_id', clientId)
    .order('log_date', { ascending: false })
    .limit(limit)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
