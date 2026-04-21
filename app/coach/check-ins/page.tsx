import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ScheduleSection from './ScheduleSection'

export default async function CoachCheckInsPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  const { data: clientRows } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', coachId)
    .eq('status', 'active')

  const clientIds = (clientRows ?? []).map((r) => r.client_id)

  type Entry =
    | { kind: 'checkin'; id: string; client_id: string; date: string; reviewed: boolean; sleep_hours: number | null; sleep_quality: string | null; energy_level: string | null; rhr: number | null; hrv: number | null; notes: string | null }
    | { kind: 'autoflow'; id: string; client_id: string; date: string; flow_name: string; step_number: number; reviewed: boolean }
    | { kind: 'form'; id: string; client_id: string; date: string; form_id: string; title: string; reviewed: boolean }

  let entries: Entry[] = []
  let profileMap: Record<string, { email: string; name: string | null }> = {}

  if (clientIds.length) {
    const admin = createAdminClient()

    const [{ data: profiles }, { data: ci }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, email, full_name, first_name')
        .in('id', clientIds),
      admin
        .from('check_ins')
        .select('id, user_id, created_at, sleep_hours, sleep_quality, energy_level, rhr, hrv, notes, reviewed_by_coach')
        .in('user_id', clientIds)
        .or('sleep_hours.not.is.null,notes.not.is.null,rhr.not.is.null,hrv.not.is.null,energy_level.not.is.null,sleep_quality.not.is.null')
        .order('created_at', { ascending: false })
        .limit(60),
    ])

    profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [
        p.id,
        {
          email: p.email as string,
          name: ((p as Record<string, unknown>).full_name as string | null) ?? ((p as Record<string, unknown>).first_name as string | null) ?? null,
        },
      ])
    )

    for (const c of ci ?? []) {
      entries.push({
        kind: 'checkin',
        id: c.id,
        client_id: c.user_id,
        date: c.created_at,
        reviewed: (c as Record<string, unknown>).reviewed_by_coach as boolean ?? false,
        sleep_hours: c.sleep_hours,
        sleep_quality: c.sleep_quality,
        energy_level: c.energy_level,
        rhr: c.rhr,
        hrv: c.hrv,
        notes: c.notes,
      })
    }

    // Form submissions linked to check-in schedules
    const { data: schedules } = await admin
      .from('checkin_schedules')
      .select('form_id, title, client_id')
      .in('client_id', clientIds)
      .eq('coach_id', coachId)

    const scheduleFormIds = (schedules ?? []).map((s) => s.form_id).filter(Boolean) as string[]
    const scheduleMeta: Record<string, { title: string; client_id: string }> = {}
    for (const s of schedules ?? []) {
      if (s.form_id) scheduleMeta[s.form_id] = { title: s.title, client_id: s.client_id }
    }

    if (scheduleFormIds.length) {
      const { data: subs } = await admin
        .from('form_submissions')
        .select('id, form_id, client_id, submitted_at, viewed_by_coach')
        .in('form_id', scheduleFormIds)
        .in('client_id', clientIds)
        .order('submitted_at', { ascending: false })
        .limit(60)
      for (const s of subs ?? []) {
        entries.push({
          kind: 'form',
          id: s.id,
          client_id: s.client_id,
          date: s.submitted_at,
          form_id: s.form_id,
          title: scheduleMeta[s.form_id]?.title ?? 'Check-in',
          reviewed: (s as Record<string, unknown>).viewed_by_coach as boolean ?? false,
        })
      }
    }

    // Autoflow responses for weekly_checkin type flows
    const { data: allFlows } = await admin
      .from('client_autoflows')
      .select('id, name, template_id, client_id')
      .in('client_id', clientIds)
      .eq('coach_id', coachId)

    if (allFlows?.length) {
      const tplIds = [...new Set(allFlows.map((f) => f.template_id))]
      const { data: templates } = await admin
        .from('autoflow_templates')
        .select('id, type')
        .in('id', tplIds)
      const weeklyTplIds = new Set((templates ?? []).filter((t) => t.type === 'weekly_checkin').map((t) => t.id))
      const weeklyFlows = allFlows.filter((f) => weeklyTplIds.has(f.template_id))
      const weeklyFlowIds = weeklyFlows.map((f) => f.id)
      const flowMeta: Record<string, { name: string; client_id: string }> = Object.fromEntries(
        weeklyFlows.map((f) => [f.id, { name: f.name, client_id: f.client_id }])
      )

      if (weeklyFlowIds.length) {
        const { data: resps } = await admin
          .from('autoflow_responses')
          .select('id, client_autoflow_id, step_number, submitted_at, client_id, reviewed_by_coach')
          .in('client_autoflow_id', weeklyFlowIds)
          .order('submitted_at', { ascending: false })
          .limit(60)
        for (const r of resps ?? []) {
          entries.push({
            kind: 'autoflow',
            id: r.id,
            client_id: r.client_id,
            date: r.submitted_at,
            flow_name: flowMeta[r.client_autoflow_id]?.name ?? 'Check-in',
            step_number: r.step_number,
            reviewed: (r as Record<string, unknown>).reviewed_by_coach as boolean ?? false,
          })
        }
      }
    }
  }

  // ── Build next-7-days schedule ────────────────────────────────────────────

  type ScheduleClient = { clientId: string; name: string; label: string }
  type DaySchedule = { dateStr: string; dayLabel: string; clients: ScheduleClient[] }

  const scheduleByDate: Record<string, ScheduleClient[]> = {}
  const next7: string[] = []
  const nowDate = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(nowDate); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0)
    next7.push(d.toISOString().slice(0, 10))
    scheduleByDate[d.toISOString().slice(0, 10)] = []
  }

  const clientsWithSchedule = new Set<string>()

  if (clientIds.length) {
    const admin = createAdminClient()

    // Recurring scheduled check-ins (day_of_week based)
    const { data: schedules } = await admin
      .from('checkin_schedules')
      .select('client_id, day_of_week, title, start_date')
      .in('client_id', clientIds)
      .eq('coach_id', coachId)
      .eq('is_active', true)

    for (const s of schedules ?? []) {
      for (const dateStr of next7) {
        const d = new Date(dateStr + 'T00:00:00Z')
        const dow = d.getUTCDay() // 0=Sun
        if (dow === s.day_of_week && (!s.start_date || dateStr >= s.start_date)) {
          scheduleByDate[dateStr].push({
            clientId: s.client_id,
            name: profileMap[s.client_id]?.name ?? profileMap[s.client_id]?.email ?? 'Unknown',
            label: s.title ?? 'Weekly check-in',
          })
          clientsWithSchedule.add(s.client_id)
        }
      }
    }

    // Autoflow weekly_checkin steps due in next 7 days
    const { data: activeFlows } = await admin
      .from('client_autoflows')
      .select('id, name, template_id, client_id, start_date')
      .in('client_id', clientIds)
      .eq('coach_id', coachId)
      .eq('status', 'active')

    if (activeFlows?.length) {
      const tplIds = [...new Set(activeFlows.map((f) => f.template_id))]
      const { data: templates } = await admin
        .from('autoflow_templates').select('id, type').in('id', tplIds)
      const weeklyTplIds = new Set((templates ?? []).filter((t) => t.type === 'weekly_checkin').map((t) => t.id))
      const weeklyFlows = activeFlows.filter((f) => weeklyTplIds.has(f.template_id))

      if (weeklyFlows.length) {
        const weeklyTplIdList = [...new Set(weeklyFlows.map((f) => f.template_id))]
        const { data: allSteps } = await admin
          .from('autoflow_template_steps')
          .select('template_id, step_number, day_offset')
          .in('template_id', weeklyTplIdList)

        // Also find already-submitted step numbers per flow
        const weeklyFlowIds = weeklyFlows.map((f) => f.id)
        const { data: submittedResps } = await admin
          .from('autoflow_responses')
          .select('client_autoflow_id, step_number')
          .in('client_autoflow_id', weeklyFlowIds)
        const submittedSet = new Set(
          (submittedResps ?? []).map((r) => `${r.client_autoflow_id}:${r.step_number}`)
        )

        for (const flow of weeklyFlows) {
          const flowSteps = (allSteps ?? []).filter((s) => s.template_id === flow.template_id)
          for (const step of flowSteps) {
            if (submittedSet.has(`${flow.id}:${step.step_number}`)) continue
            const dayOffset = (step as Record<string, unknown>).day_offset as number ?? 0
            const [sy, sm, sd] = (flow.start_date as string).split('-').map(Number)
            const dueDate = new Date(Date.UTC(sy, sm - 1, sd + dayOffset))
            const dueDateStr = dueDate.toISOString().slice(0, 10)
            if (scheduleByDate[dueDateStr]) {
              // Avoid duplicates for same client+day
              const alreadyAdded = scheduleByDate[dueDateStr].some((c) => c.clientId === flow.client_id)
              if (!alreadyAdded) {
                scheduleByDate[dueDateStr].push({
                  clientId: flow.client_id,
                  name: profileMap[flow.client_id]?.name ?? profileMap[flow.client_id]?.email ?? 'Unknown',
                  label: `${flow.name} — Step ${step.step_number}`,
                })
                clientsWithSchedule.add(flow.client_id)
              }
            }
          }
        }
      }
    }
  }

  const days7: DaySchedule[] = next7.map((dateStr) => ({
    dateStr,
    dayLabel: new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' }),
    clients: scheduleByDate[dateStr],
  }))

  const noCheckInClients = clientIds
    .filter((id) => !clientsWithSchedule.has(id))
    .map((id) => ({
      clientId: id,
      name: profileMap[id]?.name ?? profileMap[id]?.email ?? 'Unknown',
    }))

  // Sort all entries newest first
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const SLEEP_LABELS: Record<string, string> = {
    deep_restful: 'Deep & Restful', good: 'Good', okay: 'Okay', restless: 'Restless', poor: 'Poor',
  }
  const ENERGY_SHORT: Record<string, string> = {
    peaked: 'Peaked', high: 'High', moderate: 'Moderate', low: 'Low', sore: 'Sore', depleted: 'Depleted',
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function initials(clientId: string) {
    const p = profileMap[clientId]
    const str = p?.name ?? p?.email ?? '?'
    return str[0].toUpperCase()
  }

  function displayName(clientId: string) {
    const p = profileMap[clientId]
    return p?.name ?? p?.email ?? 'Unknown'
  }

  return (
    <main className="flex-1 p-6 space-y-6 max-w-4xl w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Check-ins</h1>
        <p className="text-sm text-gray-500 mt-1">{entries.length} entries from your clients</p>
        <p className="text-xs text-gray-400 mt-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 inline-block">
          The sidebar badge shows direct check-ins not yet marked as reviewed. Open a client&apos;s file → Check-ins tab and tick &quot;Mark as reviewed&quot; to clear it.
        </p>
      </div>

      <ScheduleSection days={days7} noCheckInClients={noCheckInClients} />

      {entries.length === 0 && (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <p className="text-gray-500 font-medium">No check-ins yet</p>
          <p className="text-gray-400 text-sm mt-1">Check-ins from your clients will appear here.</p>
        </div>
      )}

      {entries.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Submitted check-ins</p>}
      <div className="space-y-3">
        {entries.map((entry) => {
          if (entry.kind === 'autoflow') {
            return (
              <a
                key={`af-${entry.id}`}
                href={`/coach/clients/${entry.client_id}?tab=checkins`}
                className="flex items-center justify-between bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-orange-600">{initials(entry.client_id)}</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{displayName(entry.client_id)}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{entry.flow_name} — Step {entry.step_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {entry.reviewed ? (
                    <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Reviewed
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
                  )}
                  <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
                </div>
              </a>
            )
          }

          if (entry.kind === 'form') {
            return (
              <a
                key={`form-${entry.id}`}
                href={`/coach/clients/${entry.client_id}?tab=checkins`}
                className="flex items-center justify-between bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">{initials(entry.client_id)}</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{displayName(entry.client_id)}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{entry.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {entry.reviewed ? (
                    <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Reviewed
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
                  )}
                  <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
                </div>
              </a>
            )
          }

          // kind === 'checkin'
          return (
            <a
              key={`ci-${entry.id}`}
              href={`/coach/clients/${entry.client_id}?tab=checkins`}
              className="block bg-white rounded-2xl border p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">{initials(entry.client_id)}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{displayName(entry.client_id)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {entry.reviewed ? (
                    <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Reviewed
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-50 text-amber-500 font-semibold px-2 py-0.5 rounded-full">Pending review</span>
                  )}
                  <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Sleep</p>
                  <p className="text-sm font-semibold text-gray-900">{entry.sleep_hours != null ? `${entry.sleep_hours}h` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Quality</p>
                  <p className="text-sm font-semibold text-gray-900">{SLEEP_LABELS[entry.sleep_quality ?? ''] ?? entry.sleep_quality ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Energy</p>
                  <p className="text-sm font-semibold text-gray-900">{ENERGY_SHORT[entry.energy_level ?? ''] ?? entry.energy_level ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">RHR</p>
                  <p className="text-sm font-semibold text-gray-900">{entry.rhr != null ? `${entry.rhr}` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">HRV</p>
                  <p className="text-sm font-semibold text-gray-900">{entry.hrv != null ? `${entry.hrv}` : '—'}</p>
                </div>
              </div>
              {entry.notes && (
                <p className="text-xs text-gray-500 italic mt-3 border-t border-gray-50 pt-3">&quot;{entry.notes}&quot;</p>
              )}
            </a>
          )
        })}
      </div>
    </main>
  )
}
