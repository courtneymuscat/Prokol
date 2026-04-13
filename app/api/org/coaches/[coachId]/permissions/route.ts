import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ coachId: string }> },
) {
  const { coachId } = await params

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try {
    membership = await requireOrgRole(session.user.id, 'admin')
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status: 403 })
  }

  const {
    can_view_all_clients,
    can_reassign_clients,
    can_use_org_templates,
    can_message_all_clients,
    can_view_org_analytics,
  } = await req.json() as {
    can_view_all_clients?: boolean
    can_reassign_clients?: boolean
    can_use_org_templates?: boolean
    can_message_all_clients?: boolean
    can_view_org_analytics?: boolean
  }

  // Build update — only include fields that were explicitly provided
  const updates: Record<string, unknown> = { updated_by: session.user.id, updated_at: new Date().toISOString() }
  if (can_view_all_clients !== undefined) updates.can_view_all_clients = can_view_all_clients
  if (can_reassign_clients !== undefined) updates.can_reassign_clients = can_reassign_clients
  if (can_use_org_templates !== undefined) updates.can_use_org_templates = can_use_org_templates
  if (can_message_all_clients !== undefined) updates.can_message_all_clients = can_message_all_clients
  if (can_view_org_analytics !== undefined) updates.can_view_org_analytics = can_view_org_analytics

  const admin = createAdminClient()

  // Upsert so we don't require the record to exist first
  const { error } = await admin
    .from('org_coach_permissions')
    .upsert(
      { org_id: membership.org_id, coach_id: coachId, ...updates },
      { onConflict: 'org_id,coach_id' },
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
