import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ClientSummaryProps = {
  coachId: string
  clients: { id: string; name: string | null; email: string }[]
}

const EVENT_LABELS: Record<string, string> = {
  personal: 'Personal',
  travel: 'Travel / Away',
  extra_activity: 'Extra Activity',
  note: 'Note',
  birthday: 'Birthday',
}

const EVENT_COLOURS: Record<string, string> = {
  personal:       'bg-orange-50 text-orange-700 border-orange-200',
  travel:         'bg-teal-50 text-teal-700 border-teal-200',
  extra_activity: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  note:           'bg-yellow-50 text-yellow-700 border-yellow-200',
  birthday:       'bg-pink-50 text-pink-700 border-pink-200',
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default async function ClientSummaries({ coachId, clients }: ClientSummaryProps) {
  if (clients.length === 0) return null

  const clientIds = clients.map((c) => c.id)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: goals }, { data: profiles }, { data: events }] = await Promise.all([
    // Goals — coach can read via RLS (coach_id = auth.uid())
    supabase
      .from('client_goals')
      .select('client_id, main_goal, mini_goals')
      .eq('coach_id', coachId)
      .in('client_id', clientIds),

    // Profiles with daily targets
    admin
      .from('profiles')
      .select('id, target_calories, target_protein, target_carbs, target_fat')
      .in('id', clientIds),

    // Upcoming calendar events — need admin since client events have coach_id=null
    admin
      .from('calendar_events')
      .select('client_id, event_date, type, title')
      .in('client_id', clientIds)
      .gte('event_date', todayStr)
      .lte('event_date', in14)
      .in('type', ['personal', 'travel', 'extra_activity', 'note', 'birthday'])
      .order('event_date', { ascending: true }),
  ])

  const goalsMap = Object.fromEntries((goals ?? []).map((g) => [g.client_id, g]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  // Group events by client_id, dedup travel (same title on consecutive days show once)
  const eventsMap: Record<string, { event_date: string; type: string; title: string }[]> = {}
  for (const ev of (events ?? [])) {
    if (!eventsMap[ev.client_id]) eventsMap[ev.client_id] = []
    const clientEvs = eventsMap[ev.client_id]
    // Deduplicate consecutive travel/birthday days — only show first occurrence per title
    const isDupe = clientEvs.some((e) => e.title === ev.title && e.type === ev.type)
    if (!isDupe) clientEvs.push(ev)
  }

  const hasAnyData = clients.some((c) => {
    const g = goalsMap[c.id]
    const p = profileMap[c.id]
    const e = eventsMap[c.id]
    return (g?.main_goal || (g?.mini_goals ?? []).length > 0 || p?.target_calories || (e ?? []).length > 0)
  })

  if (!hasAnyData) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Client Summaries</h2>
      <div className="space-y-3">
        {clients.map((client) => {
          const g = goalsMap[client.id]
          const p = profileMap[client.id]
          const upcomingEvents = eventsMap[client.id] ?? []
          const miniGoals: string[] = Array.isArray(g?.mini_goals) ? g.mini_goals : []
          const hasTargets = p?.target_calories
          const hasContent = g?.main_goal || miniGoals.length > 0 || hasTargets || upcomingEvents.length > 0
          if (!hasContent) return null

          return (
            <a
              key={client.id}
              href={`/coach/clients/${client.id}`}
              className="block bg-white rounded-2xl border p-5 hover:shadow-sm transition-shadow group"
            >
              {/* Client name */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">{(client.name ?? client.email)[0].toUpperCase()}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{client.name ?? client.email}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Goals */}
                {(g?.main_goal || miniGoals.length > 0) && (
                  <div className="space-y-2">
                    {g?.main_goal && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Main goal</p>
                        <p className="text-sm text-gray-800">{g.main_goal}</p>
                      </div>
                    )}
                    {miniGoals.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">This week</p>
                        <ul className="space-y-0.5">
                          {miniGoals.map((mg, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                              <span className="mt-0.5 w-3 h-3 rounded-full border-2 border-blue-300 flex-shrink-0" />
                              {mg}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Daily targets + upcoming events */}
                <div className="space-y-3">
                  {hasTargets && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Daily targets</p>
                      <p className="text-sm font-bold text-gray-900">{p.target_calories?.toLocaleString()} <span className="text-xs font-normal text-gray-400">kcal</span></p>
                      {(p.target_protein || p.target_carbs || p.target_fat) && (
                        <p className="text-xs text-gray-500 mt-0.5">{p.target_protein}g P · {p.target_carbs}g C · {p.target_fat}g F</p>
                      )}
                    </div>
                  )}

                  {upcomingEvents.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Coming up</p>
                      <div className="space-y-1">
                        {upcomingEvents.slice(0, 4).map((ev, i) => (
                          <div key={i} className={`inline-flex items-center gap-1.5 border rounded-full px-2 py-0.5 text-[10px] font-medium mr-1 mb-1 ${EVENT_COLOURS[ev.type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {ev.type === 'birthday' ? '🎂 ' : ''}{ev.title}
                            <span className="opacity-60">· {fmtDate(ev.event_date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
