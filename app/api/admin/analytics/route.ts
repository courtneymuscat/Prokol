import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/admin'

function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

export async function GET() {
  await requirePlatformAdmin()
  const admin = createAdminClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const eightWeeksAgo = addDays(weekStart(now), -49) // 7 weeks back + current

  // Fetch all coach_clients rows needed
  const [activeRows, allRows, coachesRes] = await Promise.all([
    admin
      .from('coach_clients')
      .select('coach_id, client_id, accepted_at, archived_at, status')
      .in('status', ['active', 'archived']),
    admin
      .from('coach_clients')
      .select('coach_id, client_id, accepted_at, archived_at, status')
      .gte('accepted_at', eightWeeksAgo.toISOString()),
    admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('user_type', 'coach'),
  ])

  const allRowsData = activeRows.data ?? []
  const coachMap = Object.fromEntries((coachesRes.data ?? []).map(c => [c.id, c.full_name ?? c.email ?? 'Unknown']))

  // Clients by coach (active only)
  const byCoach: Record<string, number> = {}
  for (const r of allRowsData) {
    if (r.status === 'active') {
      byCoach[r.coach_id] = (byCoach[r.coach_id] ?? 0) + 1
    }
  }
  const clientsByCoach = Object.entries(byCoach)
    .map(([coach_id, count]) => ({ coach_id, coach_name: coachMap[coach_id] ?? 'Unknown', count }))
    .sort((a, b) => b.count - a.count)

  // Total active
  const totalActive = allRowsData.filter(r => r.status === 'active').length

  // MTD metrics
  const monthStartStr = toDateStr(monthStart)
  const todayStr = toDateStr(now)

  const newMTD = allRowsData.filter(r => r.accepted_at && r.accepted_at >= monthStartStr).length
  const cancelsMTD = allRowsData.filter(r => r.archived_at && r.archived_at >= monthStartStr + 'T00:00:00').length

  // Total at start of month = active + archived before month start
  const totalAtMonthStart = allRowsData.filter(r =>
    r.accepted_at && r.accepted_at < monthStartStr &&
    (!r.archived_at || r.archived_at >= monthStartStr + 'T00:00:00')
  ).length

  const mtdChurnPct = totalAtMonthStart > 0 ? Math.round((cancelsMTD / totalAtMonthStart) * 100) : 0
  const netGrowthMTD = newMTD - cancelsMTD

  // Weekly breakdown — last 8 weeks
  const weeks: Array<{
    week_label: string
    week_start: string
    total_clients: number
    new_clients: number
    churned: number
    net: number
    churn_pct: number
  }> = []

  for (let i = 7; i >= 0; i--) {
    const ws = addDays(weekStart(now), -i * 7)
    const we = addDays(ws, 6)
    const wsStr = toDateStr(ws)
    const weStr = toDateStr(we)

    const newThisWeek = allRowsData.filter(r =>
      r.accepted_at && r.accepted_at >= wsStr && r.accepted_at <= weStr + 'T23:59:59'
    ).length

    const churnedThisWeek = allRowsData.filter(r =>
      r.archived_at && r.archived_at >= wsStr + 'T00:00:00' && r.archived_at <= weStr + 'T23:59:59'
    ).length

    // Total active at start of this week
    const totalAtWeekStart = allRowsData.filter(r =>
      r.accepted_at && r.accepted_at < wsStr &&
      (!r.archived_at || r.archived_at >= wsStr + 'T00:00:00')
    ).length

    const churnPct = totalAtWeekStart > 0 ? Math.round((churnedThisWeek / totalAtWeekStart) * 100) : 0

    weeks.push({
      week_label: ws.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }),
      week_start: wsStr,
      total_clients: totalAtWeekStart + newThisWeek,
      new_clients: newThisWeek,
      churned: churnedThisWeek,
      net: newThisWeek - churnedThisWeek,
      churn_pct: churnPct,
    })
  }

  return Response.json({
    total_active: totalActive,
    new_mtd: newMTD,
    cancels_mtd: cancelsMTD,
    mtd_churn_pct: mtdChurnPct,
    net_growth_mtd: netGrowthMTD,
    clients_by_coach: clientsByCoach,
    weekly: weeks,
  })
}
