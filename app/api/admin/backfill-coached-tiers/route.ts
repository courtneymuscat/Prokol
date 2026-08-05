import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/admin'

export async function POST() {
  await requirePlatformAdmin()

  const admin = createAdminClient()

  // Find all clients in active or pending_invite coach relationships
  const { data: coachClients, error: fetchError } = await admin
    .from('coach_clients')
    .select('client_id')
    .in('status', ['active', 'pending_invite'])

  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 })

  const clientIds = [...new Set((coachClients ?? []).map((r) => r.client_id))]
  if (clientIds.length === 0) return Response.json({ updated: 0 })

  // Upgrade any coached clients that still have a lower tier stored
  const { error: updateError, count } = await admin
    .from('profiles')
    .update({ subscription_tier: 'coached' })
    .in('id', clientIds)
    .neq('subscription_tier', 'coached')

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  return Response.json({ updated: count ?? 0, total_coached_clients: clientIds.length })
}
