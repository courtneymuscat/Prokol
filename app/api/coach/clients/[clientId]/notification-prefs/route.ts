import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

const EVENT_COLUMNS = ['food', 'weight', 'cycle', 'workout', 'habit', 'photo'] as const
type EventColumn = (typeof EVENT_COLUMNS)[number]

// Defaults match the migration — keep in sync so a missing row reads the
// same as an inserted-with-defaults row.
const DEFAULT_PREFS: Record<EventColumn, boolean> = {
  food: false,
  weight: false,
  cycle: false,
  workout: true,
  habit: false,
  photo: true,
}

async function assertCoachOwnsClient(coachId: string, clientId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('coach_clients')
    .select('coach_id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .maybeSingle()
  return !!data
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  const { clientId } = await params

  if (!(await assertCoachOwnsClient(coachId, clientId))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_notification_prefs')
    .select('food, weight, cycle, workout, habit, photo')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .maybeSingle()

  return Response.json({ ...DEFAULT_PREFS, ...(data ?? {}) })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  const { clientId } = await params

  if (!(await assertCoachOwnsClient(coachId, clientId))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const patch: Record<string, boolean> = {}
  for (const col of EVENT_COLUMNS) {
    if (typeof body[col] === 'boolean') patch[col] = body[col] as boolean
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'No valid fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_notification_prefs')
    .upsert(
      { coach_id: coachId, client_id: clientId, ...patch },
      { onConflict: 'coach_id,client_id' },
    )
    .select('food, weight, cycle, workout, habit, photo')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ...DEFAULT_PREFS, ...data })
}
