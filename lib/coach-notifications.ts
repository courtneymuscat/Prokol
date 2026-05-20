import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push'

export type CoachNotifyEvent =
  | 'food'
  | 'weight'
  | 'cycle'
  | 'workout'
  | 'habit'
  | 'photo'

const EVENT_LABEL: Record<CoachNotifyEvent, string> = {
  food: 'food',
  weight: 'a weigh-in',
  cycle: 'a cycle entry',
  workout: 'a workout',
  habit: 'habits',
  photo: 'a progress photo',
}

const EVENT_URL: Record<CoachNotifyEvent, (clientId: string) => string> = {
  food:    (id) => `/coach/clients/${id}?tab=food`,
  weight:  (id) => `/coach/clients/${id}?tab=measurements`,
  cycle:   (id) => `/coach/clients/${id}?tab=cycle`,
  workout: (id) => `/coach/clients/${id}?tab=calendar`,
  habit:   (id) => `/coach/clients/${id}`,
  photo:   (id) => `/coach/clients/${id}?tab=progress`,
}

/**
 * Fire a push to the client's coach when they log an event — gated by the
 * coach's per-client preference toggle. Safe to call fire-and-forget; logs
 * silently and never throws back into the caller's path.
 *
 * The `tag` collapses repeated events of the same type for the same client
 * into a single notification, so a coach watching food logs doesn't get
 * twenty pings if their client logs every snack.
 */
export async function notifyCoachOfClientLog(
  clientId: string,
  event: CoachNotifyEvent,
): Promise<void> {
  try {
    const admin = createServiceClient()

    // Resolve all active coaches for this client. Most clients have one but
    // the schema allows multiple — we notify every coach whose pref is on.
    const { data: rels } = await admin
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', clientId)
      .eq('status', 'active')

    if (!rels || rels.length === 0) return

    const coachIds = rels.map((r) => r.coach_id as string)

    const { data: prefs } = await admin
      .from('coach_notification_prefs')
      .select(`coach_id, ${event}`)
      .in('coach_id', coachIds)
      .eq('client_id', clientId)

    const enabledCoaches = (prefs ?? [])
      .filter((p) => (p as Record<string, unknown>)[event] === true)
      .map((p) => (p as { coach_id: string }).coach_id)

    if (enabledCoaches.length === 0) return

    // Look up the client's display name once for the push body
    const { data: profile } = await admin
      .from('profiles')
      .select('first_name, full_name')
      .eq('id', clientId)
      .single()
    const clientName =
      profile?.first_name?.trim() || profile?.full_name?.trim()?.split(' ')[0] || 'Your client'

    const body = `${clientName} just logged ${EVENT_LABEL[event]}`
    const url = EVENT_URL[event](clientId)

    await Promise.allSettled(
      enabledCoaches.map((coachId) =>
        sendPushToUser(coachId, {
          title: 'Client activity',
          body,
          url,
          icon: '/icons/icon-192.png',
          tag: `client-log-${event}-${clientId}`,
        }),
      ),
    )
  } catch (err) {
    console.error('notifyCoachOfClientLog failed', { clientId, event, err })
  }
}
