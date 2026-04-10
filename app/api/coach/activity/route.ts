import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  // Get all active client IDs
  const { data: clientRows } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', coachId)
    .eq('status', 'active')

  const clientIds = (clientRows ?? []).map((r) => r.client_id)
  if (!clientIds.length) return Response.json({ activity: [], lapsed: [] })

  // Get client profiles for display
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', clientIds)
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email as string]))

  // Fetch recent activity in parallel
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get all client_autoflow IDs for this coach so we can match autoflow responses
  const { data: clientFlows } = await supabase
    .from('client_autoflows')
    .select('id, client_id, name')
    .eq('coach_id', coachId)
    .in('client_id', clientIds)
  const flowMap = Object.fromEntries((clientFlows ?? []).map(f => [f.id, { clientId: f.client_id, name: f.name }]))
  const flowIds = Object.keys(flowMap)

  const [{ data: checkIns }, { data: formSubs }, { data: workouts }, { data: autoflowResps }] = await Promise.all([
    supabase
      .from('check_ins')
      .select('id, user_id, created_at')
      .in('user_id', clientIds)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('form_submissions')
      .select('id, client_id, submitted_at, viewed_by_coach')
      .eq('coach_id', coachId)
      .gte('submitted_at', sevenDaysAgo)
      .order('submitted_at', { ascending: false })
      .limit(30),

    supabase
      .from('workouts')
      .select('id, user_id, name, started_at')
      .in('user_id', clientIds)
      .gte('started_at', sevenDaysAgo)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(30),

    flowIds.length
      ? supabase
          .from('autoflow_responses')
          .select('id, client_autoflow_id, step_number, submitted_at')
          .in('client_autoflow_id', flowIds)
          .gte('submitted_at', sevenDaysAgo)
          .order('submitted_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as { id: string; client_autoflow_id: string; step_number: number; submitted_at: string }[] }),
  ])

  type ActivityItem = {
    type: 'checkin' | 'form_submission' | 'workout' | 'autoflow_response'
    clientId: string
    clientEmail: string
    timestamp: string
    label: string
    unread?: boolean
    id: string
  }

  const activity: ActivityItem[] = [
    ...(checkIns ?? []).map((c) => ({
      type: 'checkin' as const,
      clientId: c.user_id,
      clientEmail: profileMap[c.user_id] ?? 'Unknown',
      timestamp: c.created_at,
      label: 'Submitted a daily check-in',
      id: c.id,
    })),
    ...(formSubs ?? []).map((s) => ({
      type: 'form_submission' as const,
      clientId: s.client_id,
      clientEmail: profileMap[s.client_id] ?? 'Unknown',
      timestamp: s.submitted_at,
      label: 'Submitted a form',
      unread: !s.viewed_by_coach,
      id: s.id,
    })),
    ...(workouts ?? []).map((w) => ({
      type: 'workout' as const,
      clientId: w.user_id,
      clientEmail: profileMap[w.user_id] ?? 'Unknown',
      timestamp: w.started_at,
      label: `Logged a workout: ${w.name}`,
      id: w.id,
    })),
    ...(autoflowResps ?? []).map((r) => {
      const flow = flowMap[r.client_autoflow_id]
      return {
        type: 'autoflow_response' as const,
        clientId: flow?.clientId ?? '',
        clientEmail: profileMap[flow?.clientId ?? ''] ?? 'Unknown',
        timestamp: r.submitted_at,
        label: `Completed step ${r.step_number} of autoflow: ${flow?.name ?? ''}`,
        unread: true,
        id: r.id,
      }
    }).filter(r => r.clientId),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 40)

  // Clients who haven't checked in within 7 days
  const recentCheckInClients = new Set((checkIns ?? []).map((c) => c.user_id))
  const lapsed = clientIds
    .filter((id) => !recentCheckInClients.has(id))
    .map((id) => ({ clientId: id, clientEmail: profileMap[id] ?? 'Unknown' }))

  return Response.json({ activity, lapsed })
}
