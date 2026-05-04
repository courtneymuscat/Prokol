import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole, getCoachPermissions } from '@/lib/org'

function weekStart(date: Date): Date {
  const d = new Date(date)
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function ds(d: Date) { return d.toISOString().split('T')[0] }

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

  const admin = createAdminClient()
  const now = new Date()
  const monthStart = ds(new Date(now.getFullYear(), now.getMonth(), 1))

  const { data: orgMembers } = await admin
    .from('org_members').select('user_id')
    .eq('org_id', membership.org_id).eq('is_active', true)

  const coachIds = (orgMembers ?? []).map(m => m.user_id)
  if (!coachIds.length) return Response.json({ total_active: 0, new_mtd: 0, cancels_mtd: 0, mtd_churn_pct: 0, net_growth_mtd: 0, clients_by_coach: [], weekly: [] })

  const [rows, coachProfiles] = await Promise.all([
    admin.from('coach_clients').select('coach_id, client_id, accepted_at, archived_at, status')
      .in('coach_id', coachIds).in('status', ['active', 'archived']),
    admin.from('profiles').select('id, full_name, email').in('id', coachIds),
  ])

  const data = rows.data ?? []
  const coachMap = Object.fromEntries((coachProfiles.data ?? []).map(c => [c.id, c.full_name ?? c.email ?? 'Unknown']))

  const totalActive = data.filter(r => r.status === 'active').length

  const byCoach: Record<string, number> = {}
  for (const r of data) if (r.status === 'active') byCoach[r.coach_id] = (byCoach[r.coach_id] ?? 0) + 1
  const clients_by_coach = Object.entries(byCoach)
    .map(([id, count]) => ({ name: coachMap[id] ?? 'Unknown', count }))
    .sort((a, b) => b.count - a.count)

  const newMTD = data.filter(r => r.accepted_at && r.accepted_at >= monthStart).length
  const cancelsMTD = data.filter(r => r.archived_at && r.archived_at >= monthStart + 'T00:00:00').length
  const totalAtMonthStart = data.filter(r =>
    r.accepted_at && r.accepted_at < monthStart &&
    (!r.archived_at || r.archived_at >= monthStart + 'T00:00:00')
  ).length
  const mtdChurnPct = totalAtMonthStart > 0 ? Math.round((cancelsMTD / totalAtMonthStart) * 100) : 0

  const weekly = Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(weekStart(now), -(7 - i) * 7)
    const we = addDays(ws, 6)
    const wsStr = ds(ws); const weEnd = ds(we) + 'T23:59:59'; const wsStart = wsStr + 'T00:00:00'
    const newC = data.filter(r => r.accepted_at && r.accepted_at >= wsStr && r.accepted_at <= weEnd).length
    const churned = data.filter(r => r.archived_at && r.archived_at >= wsStart && r.archived_at <= weEnd).length
    const totalAtStart = data.filter(r =>
      r.accepted_at && r.accepted_at < wsStr && (!r.archived_at || r.archived_at >= wsStart)
    ).length
    return {
      label: ws.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }),
      total: totalAtStart + newC, new: newC, churned, net: newC - churned,
      churn_pct: totalAtStart > 0 ? Math.round((churned / totalAtStart) * 100) : 0,
    }
  })

  return Response.json({ total_active: totalActive, new_mtd: newMTD, cancels_mtd: cancelsMTD, mtd_churn_pct: mtdChurnPct, net_growth_mtd: newMTD - cancelsMTD, clients_by_coach, weekly })
}
