import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { clientId } = await params
  const supabase = await createClient()

  // Verify this client actually belongs to this coach
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()

  if (!rel) return Response.json({ error: 'Client not found' }, { status: 404 })

  // Deactivate the coaching relationship
  await supabase
    .from('coach_clients')
    .update({ status: 'inactive' })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  // Revert client to free tier
  await supabase
    .from('profiles')
    .update({ subscription_tier: 'tier_1' })
    .eq('id', clientId)

  return Response.json({ ok: true })
}
