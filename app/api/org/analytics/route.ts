import { createClient } from '@/lib/supabase/server'
import { requireOrgRole, getCoachPermissions, computeOrgAnalytics } from '@/lib/org'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  // Non-admin coaches must have can_view_org_analytics
  if (membership.role === 'coach') {
    const perms = await getCoachPermissions(session.user.id, membership.org_id)
    if (!perms.can_view_org_analytics) {
      return Response.json({ error: 'Insufficient permissions to view org analytics' }, { status: 403 })
    }
  }

  const analytics = await computeOrgAnalytics(membership.org_id)
  return Response.json(analytics)
}
