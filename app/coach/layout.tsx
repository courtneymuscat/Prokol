import { createClient } from '@/lib/supabase/server'
import CoachSidebar from './CoachSidebar'
import { Suspense } from 'react'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  let unread = 0
  let unreadMessages = 0
  let unreadCheckIns = 0
  let isBusinessTier = false

  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const [convosResult, profileResult, clientsResult] = await Promise.all([
        supabase
          .from('conversations')
          .select('id')
          .eq('coach_id', session.user.id),
        supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', session.user.id)
          .single(),
        supabase
          .from('coach_clients')
          .select('client_id')
          .eq('coach_id', session.user.id)
          .eq('status', 'active'),
      ])

      isBusinessTier = profileResult.data?.subscription_tier === 'coach_business'

      const clientIds = (clientsResult.data ?? []).map((r) => r.client_id)
      const convoIds = (convosResult.data ?? []).map((c) => c.id)

      const [messagesResult, checkInsResult] = await Promise.all([
        convoIds.length
          ? supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .in('conversation_id', convoIds)
              .neq('sender_id', session.user.id)
              .is('read_at', null)
          : Promise.resolve({ count: 0 }),
        clientIds.length
          ? (async () => {
              const { createAdminClient } = await import('@/lib/supabase/admin')
              const admin = createAdminClient()
              const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()

              // Get all check-in schedule form IDs — these belong under Check-ins, not Forms
              const { data: scheduleRows } = await admin
                .from('checkin_schedules')
                .select('form_id')
                .eq('coach_id', session.user.id)
                .not('form_id', 'is', null)
              const checkinFormIds = new Set(
                (scheduleRows ?? []).map((r) => r.form_id).filter(Boolean) as string[]
              )

              // Unread Forms submissions — explicitly exclude check-in schedule forms
              let formsCount = 0
              if (checkinFormIds.size > 0) {
                const { count } = await admin
                  .from('form_submissions')
                  .select('id', { count: 'exact', head: true })
                  .eq('coach_id', session.user.id)
                  .eq('viewed_by_coach', false)
                  .not('form_id', 'in', `(${[...checkinFormIds].join(',')})`)
                formsCount = count ?? 0
              } else {
                const { count } = await admin
                  .from('form_submissions')
                  .select('id', { count: 'exact', head: true })
                  .eq('coach_id', session.user.id)
                  .eq('viewed_by_coach', false)
                formsCount = count ?? 0
              }
              unread = formsCount

              // Unreviewed direct check-ins (with real data)
              const { count: ciCount } = await admin
                .from('check_ins')
                .select('id', { count: 'exact', head: true })
                .in('user_id', clientIds)
                .eq('reviewed_by_coach', false)
                .or('sleep_hours.not.is.null,notes.not.is.null,rhr.not.is.null,hrv.not.is.null,energy_level.not.is.null,sleep_quality.not.is.null')

              // Autoflow check-in responses from last 14 days
              const { data: weeklyFlows } = await admin
                .from('client_autoflows')
                .select('id, template_id')
                .in('client_id', clientIds)
              const tplIds = [...new Set((weeklyFlows ?? []).map((f) => f.template_id))]
              let autoflowCount = 0
              if (tplIds.length) {
                const { data: tpls } = await admin
                  .from('autoflow_templates')
                  .select('id, type')
                  .in('id', tplIds)
                const weeklyTplIds = new Set((tpls ?? []).filter((t) => t.type === 'weekly_checkin').map((t) => t.id))
                const weeklyFlowIds = (weeklyFlows ?? []).filter((f) => weeklyTplIds.has(f.template_id)).map((f) => f.id)
                if (weeklyFlowIds.length) {
                  const { count } = await admin
                    .from('autoflow_responses')
                    .select('id', { count: 'exact', head: true })
                    .in('client_autoflow_id', weeklyFlowIds)
                    .gte('submitted_at', fourteenDaysAgo)
                    .or('reviewed_by_coach.is.null,reviewed_by_coach.eq.false')
                  autoflowCount = count ?? 0
                }
              }

              // Unread check-in schedule form submissions (for Check-ins badge)
              let scheduleFormCount = 0
              if (checkinFormIds.size > 0) {
                const { count } = await admin
                  .from('form_submissions')
                  .select('id', { count: 'exact', head: true })
                  .in('form_id', [...checkinFormIds])
                  .eq('coach_id', session.user.id)
                  .eq('viewed_by_coach', false)
                scheduleFormCount = count ?? 0
              }

              return { count: (ciCount ?? 0) + autoflowCount + scheduleFormCount }
            })()
          : Promise.resolve({ count: 0 }),
      ])

      unreadMessages = messagesResult.count ?? 0
      unreadCheckIns = checkInsResult.count ?? 0
    }
  } catch {
    // silently fall back to 0
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Suspense required because CoachSidebar uses useSearchParams */}
      <Suspense fallback={<aside className="hidden md:block w-56 shrink-0" />}>
        <CoachSidebar
          unreadCount={unread}
          unreadMessages={unreadMessages}
          unreadCheckIns={unreadCheckIns}
          isBusinessTier={isBusinessTier}
        />
      </Suspense>
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
