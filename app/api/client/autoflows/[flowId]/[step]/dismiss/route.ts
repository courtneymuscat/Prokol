import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ flowId: string; step: string }> }

// Dismissing a check-in step is permanent — it never resurfaces on its own.
// Reuses the existing snooze_until column (the due-check already filters on
// `snooze_until > now`) rather than adding a new column: a far-future date
// satisfies that comparison indefinitely, so no other query needs to change.
// Was a 7-day snooze until Court asked for X to mean "gone for good" instead.
const PERMANENT_DISMISS_UNTIL = '9999-12-31T00:00:00.000Z'

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

  const { error } = await supabase
    .from('autoflow_step_dismissals')
    .insert({
      client_autoflow_id: flowId,
      step_number: stepNum,
      client_id: user.id,
      snooze_until: PERMANENT_DISMISS_UNTIL,
    })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, snooze_until: PERMANENT_DISMISS_UNTIL })
}
