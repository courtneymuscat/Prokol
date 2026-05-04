import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push'

/**
 * Runs every hour via Vercel Cron.
 * For each client, checks if it's currently 7am or 8pm in THEIR timezone.
 *
 * At 7am: autoflow task reminders, scheduled check-in reminders, birthday alerts to coaches.
 * At 8pm: cycle tracking reminders for female clients who haven't logged today.
 *
 * Secured by CRON_SECRET.
 *
 * Requires DB column: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cycle_reminders boolean DEFAULT true;
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  let pushed = 0

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Returns the local hour (0-23), local date string (YYYY-MM-DD),
   * and local day-of-week (0=Sun) for a given IANA timezone.
   * Falls back to UTC if the timezone is invalid.
   */
  function getLocalInfo(timezone: string | null): { hour: number; dateStr: string; dayOfWeek: number } {
    const tz = timezone ?? 'UTC'
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        hour12: false,
        weekday: 'short',
      }).formatToParts(now)

      const p: Record<string, string> = Object.fromEntries(parts.map((x) => [x.type, x.value]))
      const hour = p.hour === '24' ? 0 : parseInt(p.hour ?? '0') // some locales return 24 for midnight
      const dateStr = `${p.year}-${p.month}-${p.day}`
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayOfWeek = weekdays.indexOf(p.weekday ?? 'Sun')

      return { hour, dateStr, dayOfWeek }
    } catch {
      // Invalid timezone — fall back to UTC
      const hour = now.getUTCHours()
      const dateStr = now.toISOString().split('T')[0]
      const dayOfWeek = now.getUTCDay()
      return { hour, dateStr, dayOfWeek }
    }
  }

  /** Is it the 7am hour in this timezone right now? */
  function isSevenAM(timezone: string | null): boolean {
    return getLocalInfo(timezone).hour === 7
  }

  /** Is it the 8pm hour in this timezone right now? */
  function isEightPM(timezone: string | null): boolean {
    // If no timezone set, send at 8pm UTC (catches UTC-adjacent zones)
    // Use a 2-hour window (8–9pm) to be safe against clock drift
    const { hour } = getLocalInfo(timezone)
    return hour === 20 || hour === 21
  }

  /** Days between two YYYY-MM-DD strings */
  function daysBetween(a: string, b: string): number {
    const [ay, am, ad] = a.split('-').map(Number)
    const [by, bm, bd] = b.split('-').map(Number)
    return Math.round(
      (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000
    )
  }

  // ── 1. Autoflow due steps ──────────────────────────────────────────────────

  const { data: activeFlows } = await supabase
    .from('client_autoflows')
    .select(`
      id,
      client_id,
      template_id,
      start_date,
      autoflow_responses ( step_number ),
      profiles!client_id ( timezone )
    `)
    .eq('status', 'active')

  if (activeFlows?.length) {
    for (const flow of activeFlows) {
      const profile = (flow as Record<string, unknown>).profiles as { timezone: string | null } | null
      const timezone = profile?.timezone ?? null

      if (!isSevenAM(timezone)) continue

      const { dateStr } = getLocalInfo(timezone)

      const respondedSteps = new Set(
        ((flow as Record<string, unknown>).autoflow_responses as Array<{ step_number: number }> ?? [])
          .map((r) => r.step_number)
      )

      const { data: steps } = await supabase
        .from('autoflow_template_steps')
        .select('step_number, day_offset, trigger_type')
        .eq('template_id', flow.template_id)

      if (!steps?.length) continue

      const startDate = new Date(flow.start_date + 'T00:00:00Z')

      const hasDueToday = steps.some((step) => {
        if (respondedSteps.has(step.step_number)) return false
        const s = step as Record<string, unknown>
        if (s.trigger_type === 'on_step_complete') return false
        const dueDate = new Date(startDate.getTime() + step.day_offset * 86400000)
        return dueDate.toISOString().split('T')[0] <= dateStr
      })

      if (hasDueToday) {
        sendPushToUser(flow.client_id, {
          title: 'You have tasks due today',
          body: 'Tap to view your tasks on your dashboard',
          url: '/dashboard',
          icon: '/icons/icon-192.png',
          tag: 'autoflow-due-today',
        }).catch(() => {/* silent */})
        pushed++
      }
    }
  }

  // ── 2. Scheduled check-ins due today ──────────────────────────────────────
  //
  // Sent at 7am local time when it's the client's scheduled check-in day.
  // Handles weekly, biweekly, monthly, and once repeat types correctly.

  const { data: schedules } = await supabase
    .from('checkin_schedules')
    .select(`
      client_id,
      title,
      day_of_week,
      repeat_type,
      start_date,
      profiles!client_id ( timezone )
    `)
    .eq('is_active', true)

  if (schedules?.length) {
    const notifiedClients = new Set<string>()

    for (const schedule of schedules) {
      const s = schedule as Record<string, unknown>
      const clientId = s.client_id as string
      const profile = s.profiles as { timezone: string | null } | null
      const timezone = profile?.timezone ?? null

      if (!isSevenAM(timezone)) continue
      if (notifiedClients.has(clientId)) continue

      const { dayOfWeek, dateStr } = getLocalInfo(timezone)
      const startDate = s.start_date as string
      if (startDate > dateStr) continue

      const repeatType = (s.repeat_type as string) ?? 'weekly'

      // Check if today matches this schedule's repeat pattern
      let isDueToday = false
      if (repeatType === 'once') {
        isDueToday = startDate === dateStr
      } else if (repeatType === 'weekly') {
        isDueToday = (s.day_of_week as number) === dayOfWeek
      } else if (repeatType === 'biweekly') {
        if ((s.day_of_week as number) === dayOfWeek) {
          const weeksSinceStart = Math.floor(daysBetween(startDate, dateStr) / 7)
          isDueToday = weeksSinceStart % 2 === 0
        }
      } else if (repeatType === 'monthly') {
        // Monthly: same day-of-week and same week-of-month as the start date
        const [sy, sm, sd] = startDate.split('-').map(Number)
        const startDow = new Date(sy, sm - 1, sd).getDay()
        const startWeekOfMonth = Math.floor((sd - 1) / 7)
        const [cy, cm, cd] = dateStr.split('-').map(Number)
        const todayDow = new Date(cy, cm - 1, cd).getDay()
        const todayWeekOfMonth = Math.floor((cd - 1) / 7)
        isDueToday = todayDow === startDow && todayWeekOfMonth === startWeekOfMonth
      }

      if (!isDueToday) continue

      notifiedClients.add(clientId)
      sendPushToUser(clientId, {
        title: "Check-in day 📋",
        body: `Don't forget to complete your ${s.title as string} today`,
        url: '/dashboard',
        icon: '/icons/icon-192.png',
        tag: 'scheduled-checkin',
      }).catch(() => {/* silent */})
      pushed++
    }
  }

  // ── 3. Birthday alerts for coaches ────────────────────────────────────────
  //
  // Birthday calendar events are stored as absolute dates (YYYY-MM-DD).
  // We check ±1 day from UTC to catch clients in any timezone whose
  // birthday is "today" in their local time during this hourly run.

  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0]

  const { data: birthdayEvents } = await supabase
    .from('calendar_events')
    .select(`
      client_id,
      event_date,
      profiles!client_id ( full_name, timezone )
    `)
    .eq('type', 'birthday')
    .gte('event_date', yesterday)
    .lte('event_date', tomorrow)

  if (birthdayEvents?.length) {
    for (const ev of birthdayEvents) {
      const profile = (ev as Record<string, unknown>).profiles as {
        full_name: string | null
        timezone: string | null
      } | null
      const timezone = profile?.timezone ?? null
      const clientName = profile?.full_name ?? 'A client'

      const { dateStr } = getLocalInfo(timezone)

      // Only trigger when it's actually this client's birthday in their local timezone
      if (dateStr !== ev.event_date) continue
      // Send at 7am in the client's timezone so the coach gets an early-morning heads-up
      if (!isSevenAM(timezone)) continue

      // Find active coaches for this client
      const { data: coachRels } = await supabase
        .from('coach_clients')
        .select('coach_id')
        .eq('client_id', ev.client_id)
        .eq('status', 'active')

      for (const rel of (coachRels ?? [])) {
        sendPushToUser(rel.coach_id, {
          title: `Birthday: ${clientName}`,
          body: `Today is ${clientName}'s birthday!`,
          url: `/coach/clients/${ev.client_id}`,
          icon: '/icons/icon-192.png',
          tag: `birthday-${ev.client_id}`,
        }).catch(() => {/* silent */})
        pushed++
      }
    }
  }

  // ── 4. Cycle tracking reminders for female clients ────────────────────────
  //
  // Sent at 8pm local time if the client hasn't logged today.
  // Message is phase-aware: adapts based on recent cycle history.
  // Opt-out via cycle_reminders = false on the profiles table (optional column).

  // Select without cycle_reminders first — that column may not exist yet.
  // If it does exist, fetch it separately per-user to check opt-out.
  const { data: femaleClients } = await supabase
    .from('profiles')
    .select('id, timezone')
    .eq('sex', 'female')

  // Try to get cycle_reminders opt-outs (may fail if column doesn't exist — that's fine)
  let cycleOptOuts = new Set<string>()
  try {
    const { data: optOutRows } = await supabase
      .from('profiles')
      .select('id')
      .eq('sex', 'female')
      .eq('cycle_reminders', false)
    cycleOptOuts = new Set((optOutRows ?? []).map((r: { id: string }) => r.id))
  } catch { /* column doesn't exist yet — all users get reminders */ }

  if (femaleClients?.length) {
    for (const client of femaleClients) {
      const p = client as unknown as { id: string; timezone: string | null }

      // Skip if user has opted out
      if (cycleOptOuts.has(p.id)) continue

      const timezone = p.timezone ?? null
      if (!isEightPM(timezone)) continue

      const { dateStr } = getLocalInfo(timezone)

      // Skip if they've already logged today
      const { data: todayLog } = await supabase
        .from('cycle_logs')
        .select('log_date')
        .eq('user_id', p.id)
        .eq('log_date', dateStr)
        .maybeSingle()

      if (todayLog) continue

      // ── Phase-aware message ───────────────────────────────────────────────
      // Fetch recent logs (90 days) to estimate current cycle phase
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString().split('T')[0]
      const { data: recentLogs } = await supabase
        .from('cycle_logs')
        .select('log_date, period')
        .eq('user_id', p.id)
        .gte('log_date', ninetyDaysAgo)
        .order('log_date', { ascending: true })

      // Phase-aware message pools
      const generalMessages = [
        'How are you feeling today? Log your symptoms to track your cycle.',
        'Quick check-in — how\'s your energy today?',
        'Take a moment to log today. Every entry helps you understand your patterns.',
        'How\'s your mood and energy? Your cycle data is building a picture over time.',
        'Don\'t forget to log today — it only takes a second.',
      ]

      let body = generalMessages[Math.floor(Math.random() * generalMessages.length)]

      if (recentLogs && recentLogs.length >= 2) {
        // Find period start dates (first day of each period block)
        const starts: string[] = []
        const logMap = Object.fromEntries((recentLogs as { log_date: string; period: boolean }[]).map((r) => [r.log_date, r.period]))
        const sortedDates = Object.keys(logMap).sort()
        for (const date of sortedDates) {
          if (!logMap[date]) continue
          const prevDate = sortedDates[sortedDates.indexOf(date) - 1]
          if (!prevDate || !logMap[prevDate]) starts.push(date)
        }

        if (starts.length >= 2) {
          const lengths: number[] = []
          for (let i = 1; i < starts.length; i++) {
            const diff = daysBetween(starts[i - 1], starts[i])
            if (diff >= 18 && diff <= 45) lengths.push(diff)
          }

          if (lengths.length > 0) {
            const recent3 = lengths.slice(-3)
            const avgLen = Math.round(recent3.reduce((a, b) => a + b, 0) / recent3.length)
            const lastStart = starts[starts.length - 1]
            const dayOfCycle = daysBetween(lastStart, dateStr) + 1
            const daysUntilPeriod = avgLen - dayOfCycle

            if (dayOfCycle >= 1 && dayOfCycle <= 5) {
              // Menstrual phase
              const messages = [
                'How\'s your flow today? Log your period symptoms.',
                'Period day — how are you feeling? Log your flow and energy.',
                'How\'s your energy during your period? Take a moment to log.',
                'Tracking cramps, flow, and mood during your period helps spot patterns.',
              ]
              body = messages[Math.floor(Math.random() * messages.length)]
            } else if (daysUntilPeriod >= 0 && daysUntilPeriod <= 2) {
              // Late luteal — period imminent
              if (daysUntilPeriod === 0) {
                const messages = [
                  'Your period could arrive any day — how are you feeling?',
                  'Period due today or very soon — log any symptoms you\'re noticing.',
                ]
                body = messages[Math.floor(Math.random() * messages.length)]
              } else {
                const d = daysUntilPeriod === 1 ? 'tomorrow' : 'in 2 days'
                const messages = [
                  `Period predicted ${d} — log any pre-period symptoms.`,
                  `Almost time — how are you feeling as your period approaches ${d}?`,
                ]
                body = messages[Math.floor(Math.random() * messages.length)]
              }
            } else if (daysUntilPeriod >= 3 && daysUntilPeriod <= 7) {
              // Luteal phase — PMS window
              const messages = [
                'How\'s your mood today? You\'re in your luteal phase.',
                'Luteal phase check-in — log mood, energy and any PMS symptoms.',
                'How\'s your energy and sleep in the lead-up to your period?',
                'Any cravings or mood changes today? Log them to spot your PMS pattern.',
              ]
              body = messages[Math.floor(Math.random() * messages.length)]
            } else if (dayOfCycle >= 11 && dayOfCycle <= 17) {
              // Ovulation window
              const messages = [
                'You may be approaching ovulation — how\'s your energy?',
                'Ovulation window — log cervical mucus and how you\'re feeling.',
                'Peak energy phase incoming — how are you feeling today?',
                'Any ovulation symptoms? Log them to confirm your fertile window.',
              ]
              body = messages[Math.floor(Math.random() * messages.length)]
            } else {
              // Follicular phase (post-period, pre-ovulation)
              const messages = [
                'How\'s your energy today? You\'re in your follicular phase.',
                'Log how you\'re feeling — energy tends to rise this week.',
                'Quick daily log — mood, energy, sleep. Takes 10 seconds.',
              ]
              body = messages[Math.floor(Math.random() * messages.length)]
            }
          }
        }
      }

      sendPushToUser(p.id, {
        title: 'Cycle log reminder',
        body,
        url: '/cycle',
        icon: '/icons/icon-192.png',
        tag: 'cycle-reminder',
      }).catch(() => {/* silent */})
      pushed++
    }
  }

  // ── 5. 7-day no-check-in reminder ────────────────────────────────────────────
  //
  // Sent at 7am local time if the client hasn't submitted any check-in
  // (check_ins or autoflow_responses) in the past 7 days.

  const { data: activeClients } = await supabase
    .from('coach_clients')
    .select('client_id, profiles!client_id ( timezone )')
    .eq('status', 'active')

  if (activeClients?.length) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
    const uniqueClientIds = [...new Set(activeClients.map((r) => r.client_id))]

    const [{ data: recentCheckIns }, { data: recentAutoflow }] = await Promise.all([
      supabase
        .from('check_ins')
        .select('user_id, created_at')
        .in('user_id', uniqueClientIds)
        .gte('created_at', sevenDaysAgo)
        .or('sleep_hours.not.is.null,notes.not.is.null,rhr.not.is.null,hrv.not.is.null'),
      supabase
        .from('autoflow_responses')
        .select('client_id, submitted_at')
        .in('client_id', uniqueClientIds)
        .gte('submitted_at', sevenDaysAgo),
    ])

    const recentSet = new Set<string>()
    for (const c of recentCheckIns ?? []) recentSet.add(c.user_id)
    for (const r of recentAutoflow ?? []) recentSet.add(r.client_id)

    const notifiedInThisRun = new Set<string>()
    for (const row of activeClients) {
      const clientId = row.client_id
      if (recentSet.has(clientId)) continue
      if (notifiedInThisRun.has(clientId)) continue

      const profile = (row as Record<string, unknown>).profiles as { timezone: string | null } | null
      const timezone = profile?.timezone ?? null
      if (!isSevenAM(timezone)) continue

      notifiedInThisRun.add(clientId)
      sendPushToUser(clientId, {
        title: 'Check in with your coach',
        body: "It's been a while — your coach would love to hear how you're going",
        url: '/dashboard',
        icon: '/icons/icon-192.png',
        tag: 'no-checkin-reminder',
      }).catch(() => {/* silent */})
      pushed++
    }
  }

  return Response.json({ ok: true, pushed, checkedAt: now.toISOString() })
}
