import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ClientSummaryProps = {
  coachId: string
  clients: { id: string; name: string | null; email: string }[]
}

const EVENT_COLOURS: Record<string, string> = {
  personal:       'bg-orange-50 text-orange-600 border-orange-100',
  travel:         'bg-teal-50 text-teal-600 border-teal-100',
  extra_activity: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  note:           'bg-yellow-50 text-yellow-600 border-yellow-100',
  birthday:       'bg-pink-50 text-pink-600 border-pink-100',
}

const EVENT_ICONS: Record<string, string> = {
  travel: '✈️', birthday: '🎂', extra_activity: '🏃', personal: '📌', note: '📝',
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default async function ClientSummaries({ coachId, clients }: ClientSummaryProps) {
  if (clients.length === 0) return null

  const clientIds = clients.map((c) => c.id)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const in21 = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: goals }, { data: profiles }, { data: events }, { data: weights }] = await Promise.all([
    supabase
      .from('client_goals')
      .select('client_id, main_goal, mini_goals')
      .eq('coach_id', coachId)
      .in('client_id', clientIds),

    admin
      .from('profiles')
      .select('id, target_calories, target_protein, target_carbs, target_fat')
      .in('id', clientIds),

    admin
      .from('calendar_events')
      .select('client_id, event_date, type, title')
      .in('client_id', clientIds)
      .gte('event_date', todayStr)
      .lte('event_date', in21)
      .in('type', ['personal', 'travel', 'extra_activity', 'note', 'birthday'])
      .order('event_date', { ascending: true }),

    // Most recent weight per client — fetch recent entries, dedupe in JS
    admin
      .from('weight_logs')
      .select('user_id, weight_kg, log_date')
      .in('user_id', clientIds)
      .order('log_date', { ascending: false })
      .limit(clientIds.length * 10),
  ])

  const goalsMap = Object.fromEntries((goals ?? []).map((g) => [g.client_id, g]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  // Most recent weight per client
  const weightMap: Record<string, number> = {}
  for (const w of weights ?? []) {
    if (!(w.user_id in weightMap)) weightMap[w.user_id] = w.weight_kg
  }

  // Deduplicate consecutive events (same title + type)
  const eventsMap: Record<string, { event_date: string; type: string; title: string }[]> = {}
  for (const ev of (events ?? [])) {
    if (!eventsMap[ev.client_id]) eventsMap[ev.client_id] = []
    const seen = eventsMap[ev.client_id]
    if (!seen.some(e => e.title === ev.title && e.type === ev.type)) seen.push(ev)
  }

  const rows = clients.map(c => {
    const g = goalsMap[c.id]
    const p = profileMap[c.id]
    const miniGoals: string[] = Array.isArray(g?.mini_goals) ? g.mini_goals.filter(Boolean) : []
    return {
      client: c,
      mainGoal: g?.main_goal ?? null,
      miniGoals,
      profile: p ?? null,
      weight: weightMap[c.id] ?? null,
      events: eventsMap[c.id] ?? [],
    }
  }).filter(r => r.mainGoal || r.miniGoals.length > 0 || r.profile?.target_calories || r.weight || r.events.length > 0)

  if (rows.length === 0) return null

  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-0.5">Client overview</p>
      <div className="space-y-2">
        {rows.map(({ client, mainGoal, miniGoals, profile, weight, events: evs }) => (
          <a
            key={client.id}
            href={`/coach/clients/${client.id}`}
            className="block bg-white rounded-2xl border px-4 py-3.5 hover:shadow-sm transition-shadow group"
          >
            {/* Header row */}
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-blue-500">
                  {(client.name ?? client.email)[0].toUpperCase()}
                </span>
              </div>

              {/* Name */}
              <p className="text-sm font-semibold text-gray-900 truncate w-28 flex-shrink-0">
                {client.name ?? client.email.split('@')[0]}
              </p>

              {/* Main goal — fills available space */}
              {mainGoal ? (
                <p className="flex-1 text-sm text-gray-400 truncate min-w-0 hidden sm:block">{mainGoal}</p>
              ) : (
                <span className="flex-1 hidden sm:block" />
              )}

              {/* Current weight */}
              {weight !== null && (
                <span className="text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5 flex-shrink-0 whitespace-nowrap">
                  {weight % 1 === 0 ? weight : weight.toFixed(1)} kg
                </span>
              )}

              {/* Macro targets */}
              {profile?.target_calories && (
                <div className="hidden md:flex items-center gap-1 text-xs flex-shrink-0">
                  <span className="font-semibold text-gray-700">{Number(profile.target_calories).toLocaleString()}</span>
                  <span className="text-gray-400">kcal</span>
                  {profile.target_protein && <span className="text-pink-500 font-medium ml-1">{profile.target_protein}P</span>}
                  {profile.target_carbs && <span className="font-medium" style={{ color: '#1D9E75' }}>{profile.target_carbs}C</span>}
                  {profile.target_fat && <span className="text-green-600 font-medium">{profile.target_fat}F</span>}
                </div>
              )}

              {/* Arrow */}
              <svg className="w-4 h-4 text-gray-200 group-hover:text-gray-400 flex-shrink-0 transition-colors ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Secondary row: mini goals + events */}
            {(miniGoals.length > 0 || evs.length > 0) && (
              <div className="mt-2.5 pl-11 flex flex-wrap items-center gap-1.5">
                {miniGoals.map((mg, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-3 h-3 rounded-full border-2 border-blue-200 flex-shrink-0" />
                    {mg}
                  </span>
                ))}
                {miniGoals.length > 0 && evs.length > 0 && (
                  <span className="text-gray-200 text-xs mx-0.5">·</span>
                )}
                {evs.slice(0, 3).map((ev, i) => (
                  <span
                    key={i}
                    className={`text-[11px] font-medium border rounded-full px-2 py-0.5 flex items-center gap-1 flex-shrink-0 ${EVENT_COLOURS[ev.type] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}
                  >
                    <span>{EVENT_ICONS[ev.type]}</span>
                    <span>{ev.type === 'birthday' ? 'Birthday' : ev.title.length > 14 ? ev.title.slice(0, 14) + '…' : ev.title}</span>
                    <span className="opacity-50">{fmtDate(ev.event_date)}</span>
                  </span>
                ))}
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  )
}
