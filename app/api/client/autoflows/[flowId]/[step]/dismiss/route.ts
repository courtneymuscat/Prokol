import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ flowId: string; step: string }> }

const SNOOZE_DAYS = 7

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { flowId, step } = await params
  const stepNum = parseInt(step)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: flow } = await supabase
    .from('client_autoflows')
    .select('id')
    .eq('id', flowId)
    .eq('client_id', user.id)
    .single()
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 })

  const snoozeUntil = new Date(Date.now() + SNOOZE_DAYS * 86400000).toISOString()

  const { error } = await supabase
    .from('autoflow_step_dismissals')
    .insert({
      client_autoflow_id: flowId,
      step_number: stepNum,
      client_id: user.id,
      snooze_until: snoozeUntil,
    })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, snooze_until: snoozeUntil })
}
