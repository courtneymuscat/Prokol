import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const clientId = session.user.id

  // Find active coaching relationship
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()

  if (!rel) return Response.json({ error: 'No active coach relationship' }, { status: 404 })

  // Deactivate the relationship
  await supabase
    .from('coach_clients')
    .update({ status: 'inactive' })
    .eq('client_id', clientId)
    .eq('coach_id', rel.coach_id)

  // Revert to free tier
  await supabase
    .from('profiles')
    .update({ subscription_tier: 'tier_1' })
    .eq('id', clientId)

  return Response.json({ ok: true })
}
