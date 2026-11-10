import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

if (process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  icon?: string
  tag?: string  // deduplication key — only one notification per tag shown at once
}

/**
 * Send a push notification to all registered subscriptions for a user.
 * Non-blocking — stale subscriptions (410/404) are automatically removed.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY) return // push not configured — skip silently

  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  const message = JSON.stringify(payload)
  const staleIds: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message,
        )
      } catch (err) {
        // 410 Gone or 404 Not Found = subscription is no longer valid
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          staleIds.push(sub.id)
        }
      }
    }),
  )

  // Clean up expired subscriptions
  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }
}

/**
 * Batched version of sendPushToUser for fanning out to many users at once
 * (cron jobs, org-wide announcements) — one push_subscriptions query for
 * every recipient instead of one per recipient, which is what turns a
 * "for each client" loop into an N+1 the moment the recipient list scales
 * with roster/org size. Each recipient can carry a different payload
 * (e.g. personalised reminder text).
 */
export async function sendPushToUsers(items: { userId: string; payload: PushPayload }[]): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY || items.length === 0) return

  const supabase = createServiceClient()
  const userIds = [...new Set(items.map((i) => i.userId))]
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (!subs?.length) return

  const subsByUser = new Map<string, typeof subs>()
  for (const sub of subs) {
    const list = subsByUser.get(sub.user_id)
    if (list) list.push(sub)
    else subsByUser.set(sub.user_id, [sub])
  }

  const staleIds: string[] = []

  await Promise.allSettled(
    items.flatMap((item) =>
      (subsByUser.get(item.userId) ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(item.payload),
          )
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 410 || status === 404) staleIds.push(sub.id)
        }
      }),
    ),
  )

  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }
}
