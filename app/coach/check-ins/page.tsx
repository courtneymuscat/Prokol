import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgForUser } from '@/lib/org'
import { redirect } from 'next/navigation'
import ScheduleSection from './ScheduleSection'
import ProkolMethodCheckins from './ProkolMethodCheckins'
import CheckinsFeedList from './CheckinsFeedList'
import { PROKOL_METHOD_CHECKIN_TEMPLATE_ID } from '@/lib/prokolMethodIds'

export default async function CoachCheckInsPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/dashboard')

  const supabase = await createClient()

  // A coach who owns more than one org (gym org-switching) is still the
  // same coach_id in every one of them — without this, the review queue
  // would show every org's clients regardless of which one is active.
  const membership = await getOrgForUser(coachId)

  let clientRowsQuery = supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', coachId)
    .eq('status', 'active')
  if (membership) clientRowsQuery = clientRowsQuery.eq('org_id', membership.org_id)
  const { data: clientRows } = await clientRowsQuery

  const clientIds = (clientRows ?? []).map((r) => r.client_id)

  type FlagSeverity = 'urgent' | 'lead' | 'normal'

  // 'checkin' = a real check-in — the standalone daily check_ins table, a
  // weekly_checkin/custom-type autoflow's response, or a standalone form.
  // 'staged_flow' = a response that came from an onboarding-type (lesson)
  // autoflow step — a client marking a lesson complete, not a check-in,
  // even though it lands in autoflow_responses the same way.
  type Source = 'checkin' | 'staged_flow'

  type Entry =
    | { kind: 'checkin'; source: 'checkin'; id: string; client_id: string; date: string; reviewed: boolean; sleep_hours: number | null; sleep_quality: string | null; energy_level: string | null; rhr: number | null; hrv: number | null; notes: string | null }
    | { kind: 'autoflow'; source: Source; id: string; client_id: string; date: string; flow_name: string; step_number: number; reviewed: boolean; flagSeverity: FlagSeverity | null }
    | { kind: 'form'; source: 'checkin'; id: string; client_id: string; date: string; form_id: string; title: string; reviewed: boolean }

  let entries: Entry[] = []
  let profileMap: Record<string, { email: string; name: string | null }> = {}

  if (clientIds.length) {
    const admin = createAdminClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const [{ data: profiles }, { data: ci }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, email, full_name, first_name')
        .in('id', clientIds),
      // Show all unreviewed + reviewed only within last 30 days
      admin
        .from('check_ins')
        .select('id, user_id, created_at, sleep_hours, sleep_quality, energy_level, rhr, hrv, notes, reviewed_by_coach')
        .in('user_id', clientIds)
        .or('sleep_hours.not.is.null,notes.not.is.null,rhr.not.is.null,hrv.not.is.null,energy_level.not.is.null,sleep_quality.not.is.null')
        .or(`reviewed_by_coach.eq.false,created_at.gte.${sevenDaysAgo}`)
        .order('created_at', { ascending: false })
        .limit(100),
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
        source: 'checkin',
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

    // Form submissions surfaced from BOTH sources:
    //   1. Forms attached to a checkin_schedule
    //   2. Forms attached to an autoflow_template_step (e.g. onboarding form
    //      linked from an autoflow step) — these were previously invisible
    //      to the coach in this feed
    const formMeta: Record<string, { title: string; client_id?: string }> = {}

    const { data: schedules } = await admin
      .from('checkin_schedules')
      .select('form_id, title, client_id')
      .in('client_id', clientIds)
      .eq('coach_id', coachId)
    for (const s of schedules ?? []) {
      if (s.form_id) formMeta[s.form_id] = { title: s.title, client_id: s.client_id }
    }

    // Pull forms attached to autoflow steps in any flow this coach assigned
    const { data: assignedFlowsForForms } = await admin
      .from('client_autoflows')
      .select('template_id')
      .in('client_id', clientIds)
      .eq('coach_id', coachId)
    const flowTemplateIds = [...new Set((assignedFlowsForForms ?? []).map((f) => f.template_id).filter(Boolean) as string[])]
    if (flowTemplateIds.length) {
      const { data: stepRows } = await admin
        .from('autoflow_template_steps')
        .select('form_id')
        .in('template_id', flowTemplateIds)
        .not('form_id', 'is', null)
      const stepFormIds = [...new Set((stepRows ?? []).map((r) => (r as Record<string, unknown>).form_id as string | null).filter(Boolean) as string[])]
      if (stepFormIds.length) {
        const { data: stepForms } = await admin
          .from('forms')
          .select('id, title')
          .in('id', stepFormIds)
        for (const f of stepForms ?? []) {
          if (!formMeta[f.id]) formMeta[f.id] = { title: f.title }
        }
      }
    }

    const allFormIds = Object.keys(formMeta)
    if (allFormIds.length) {
      const { data: subs } = await admin
        .from('form_submissions')
        .select('id, form_id, client_id, submitted_at, viewed_by_coach')
        .in('form_id', allFormIds)
        .in('client_id', clientIds)
        .or(`viewed_by_coach.eq.false,submitted_at.gte.${sevenDaysAgo}`)
        .order('submitted_at', { ascending: false })
        .limit(100)
      for (const s of subs ?? []) {
        entries.push({
          kind: 'form',
          source: 'checkin',
          id: s.id,
          client_id: s.client_id,
          date: s.submitted_at,
          form_id: s.form_id,
          title: formMeta[s.form_id]?.title ?? 'Check-in',
          reviewed: (s as Record<string, unknown>).viewed_by_coach as boolean ?? false,
        })
      }
    }

    // Autoflow responses across every flow type the coach should see — was
    // restricted to weekly_checkin, which silently hid onboarding/custom
    // flow submissions from the coach's main check-ins feed.
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
      const RESPONSE_TEMPLATE_TYPES = new Set(['weekly_checkin', 'onboarding', 'custom'])
      const weeklyTplIds = new Set(
        (templates ?? [])
          .filter((t) => RESPONSE_TEMPLATE_TYPES.has((t as Record<string, unknown>).type as string))
          .map((t) => t.id),
      )
      // Prokol Method check-ins get their own rich bulk-review section
      // (ProkolMethodCheckins) above this list — excluded here so they
      // don't also show up duplicated in the plain feed below.
      const weeklyFlows = allFlows.filter((f) => weeklyTplIds.has(f.template_id) && f.template_id !== PROKOL_METHOD_CHECKIN_TEMPLATE_ID)
      const weeklyFlowIds = weeklyFlows.map((f) => f.id)
      const flowMeta: Record<string, { name: string; client_id: string }> = Object.fromEntries(
        weeklyFlows.map((f) => [f.id, { name: f.name, client_id: f.client_id }])
      )
      const templateTypeById = Object.fromEntries((templates ?? []).map((t) => [t.id, (t as Record<string, unknown>).type as string]))
      const flowSourceById: Record<string, Source> = Object.fromEntries(
        weeklyFlows.map((f) => [f.id, templateTypeById[f.template_id] === 'onboarding' ? 'staged_flow' : 'checkin']),
      )

      if (weeklyFlowIds.length) {
        const { data: resps } = await admin
          .from('autoflow_responses')
          .select('id, client_autoflow_id, step_number, submitted_at, client_id, reviewed_by_coach')
          .in('client_autoflow_id', weeklyFlowIds)
          .or(`reviewed_by_coach.is.null,reviewed_by_coach.eq.false,submitted_at.gte.${sevenDaysAgo}`)
          .order('submitted_at', { ascending: false })
          .limit(100)

        // Flags now evaluate on every autoflow (not just The Prokol Method
        // Check-ins, which gets its own richer severity-coded view above)
        // — without this, a flagged check-in from any other autoflow would
        // show up here with no indication it was flagged at all.
        const respIds = (resps ?? []).map((r) => r.id)
        const severityByResponse: Record<string, FlagSeverity> = {}
        if (respIds.length) {
          const { data: openFlags } = await admin
            .from('autoflow_response_flags')
            .select('response_id, severity')
            .in('response_id', respIds)
            .is('cleared_at', null)
          for (const f of openFlags ?? []) {
            const rid = f.response_id as string
            const sev = f.severity as FlagSeverity
            const existing = severityByResponse[rid]
            if (!existing || sev === 'urgent' || (sev === 'lead' && existing !== 'urgent')) {
              severityByResponse[rid] = sev
            }
          }
        }

        for (const r of resps ?? []) {
          entries.push({
            kind: 'autoflow',
            source: flowSourceById[r.client_autoflow_id] ?? 'checkin',
            id: r.id,
            client_id: r.client_id,
            date: r.submitted_at,
            flow_name: flowMeta[r.client_autoflow_id]?.name ?? 'Check-in',
            step_number: r.step_number,
            reviewed: (r as Record<string, unknown>).reviewed_by_coach as boolean ?? false,
            flagSeverity: severityByResponse[r.id] ?? null,
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
      // Onboarding + custom autoflows also collect responses from the
      // client, so they count as a scheduled "check-in" for the
      // "no check-in in next 7 days" calc — not just weekly_checkin.
      const RESPONSE_TYPES = new Set(['weekly_checkin', 'onboarding', 'custom'])
      const weeklyTplIds = new Set((templates ?? []).filter((t) => RESPONSE_TYPES.has(t.type as string)).map((t) => t.id))
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

  return (
    <main className="flex-1 p-6 space-y-6 w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check-ins</h1>
          <p className="text-sm text-gray-500 mt-1">{entries.length} entries from your clients</p>
          <p className="text-xs text-gray-400 mt-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 inline-block">
            The sidebar badge shows direct check-ins not yet marked as reviewed. Open a client&apos;s file → Check-ins tab and tick &quot;Mark as reviewed&quot; to clear it.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="/coach/check-ins/reports"
            className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Reports
          </a>
          <a
            href="/coach/check-ins/message-templates"
            className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Message templates
          </a>
        </div>
      </div>

      <ScheduleSection days={days7} noCheckInClients={noCheckInClients} />

      <ProkolMethodCheckins />

      <CheckinsFeedList entries={entries} profileMap={profileMap} />
    </main>
  )
}
