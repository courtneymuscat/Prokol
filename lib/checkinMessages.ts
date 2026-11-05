import type { SupabaseClient } from '@supabase/supabase-js'
import type { FlagCategory } from '@/lib/checkinFlags'

// Default text for a coach's automated check-in message templates — used
// to seed their row in coach_message_templates on first access, and as
// the fallback if that row somehow doesn't exist yet. Editable per-coach
// afterwards from Check-ins > Message templates — never hardcode wording
// changes here once a coach has their own row; edit it there instead.

export const DEFAULT_URGENT_TEMPLATE =
`Hi {first_name}, this is an automated message — something in your check-in today stood out, so we wanted to check in just in case. No pressure at all, but if things feel tough right now, support is there:
- Lifeline: 13 11 14 (24/7)
- Butterfly Foundation: 1800 33 4673 (support for eating and body image concerns)
- Your GP is a great first step if you'd like to talk it through with someone
- If you're ever in immediate danger, please call 000
You're always welcome to message {coach_name} directly here in the app too. You're not alone in this.`

export const DEFAULT_NORMAL_TEMPLATE =
`Hi {first_name}, thanks for checking in. It looks like this week was a bit harder: {flag_reason}. That's okay, as progress is never a straight line.
If you'd like more support, message {coach_name} here in the app. And if something about your health is worrying you, please check in with your GP.`

export const DEFAULT_LEAD_TEMPLATE =
`Hi {first_name}, love that you want to keep going! {coach_name} will be in touch soon to chat about what suits you best.`

export const DEFAULT_CATEGORY_SNIPPETS: Record<FlagCategory, string> = {
  under_fuelling: "it looks like you might not be eating enough to support what you're doing — try adding an extra serve at your next main meal",
  low_mood_energy: 'your mood, energy or sleep dipped — try an earlier night and a short walk outside this week',
  high_stress: 'stress has been running high — even 5 minutes of downtime a day can take the edge off',
  fast_weight_change: 'your weigh-ins have moved more than usual — this is often just water or life stuff, worth keeping an eye on',
  low_habit: "this week's habit was tough to stick to — try picking just one small win to focus on",
  missed_checkins: "it's been a little while since your last check-in — no pressure, just jump back in whenever you're ready",
}

export type CoachMessageTemplates = {
  urgent_template: string
  urgent_enabled: boolean
  normal_template: string
  lead_template: string
  category_snippets: Record<string, string>
}

export const DEFAULT_MESSAGE_TEMPLATES: CoachMessageTemplates = {
  urgent_template: DEFAULT_URGENT_TEMPLATE,
  urgent_enabled: true,
  normal_template: DEFAULT_NORMAL_TEMPLATE,
  lead_template: DEFAULT_LEAD_TEMPLATE,
  category_snippets: DEFAULT_CATEGORY_SNIPPETS,
}

/** Simple {merge_field} substitution — no escaping/looping, just plain text swaps. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match))
}

/** Joins up to 2 category snippets into one "X; Y" clause for {flag_reason}. */
export function combineCategorySnippets(categories: FlagCategory[], snippets: Record<string, string>): string {
  return categories
    .map((cat) => snippets[cat] ?? DEFAULT_CATEGORY_SNIPPETS[cat])
    .join('; ')
}

/**
 * Fetches a coach's message-template row, creating it seeded with the
 * defaults on first access (every coach gets their own editable copy —
 * see lib/checkinFlags.ts for why the behaviour this drives is platform-
 * wide even though the wording itself is per-coach).
 */
export async function getOrCreateMessageTemplates(admin: SupabaseClient, coachId: string): Promise<CoachMessageTemplates> {
  const { data: existing } = await admin
    .from('coach_message_templates')
    .select('urgent_template, urgent_enabled, normal_template, lead_template, category_snippets')
    .eq('coach_id', coachId)
    .maybeSingle()
  if (existing) return existing as CoachMessageTemplates

  const seeded = {
    coach_id: coachId,
    urgent_template: DEFAULT_URGENT_TEMPLATE,
    urgent_enabled: true,
    normal_template: DEFAULT_NORMAL_TEMPLATE,
    lead_template: DEFAULT_LEAD_TEMPLATE,
    category_snippets: DEFAULT_CATEGORY_SNIPPETS,
  }
  const { data: inserted } = await admin
    .from('coach_message_templates')
    .upsert(seeded, { onConflict: 'coach_id' })
    .select('urgent_template, urgent_enabled, normal_template, lead_template, category_snippets')
    .single()
  return (inserted as CoachMessageTemplates | null) ?? DEFAULT_MESSAGE_TEMPLATES
}

/**
 * Sends one rendered template as an in-app message from the coach's own
 * account to the client (same conversation/message tables as every other
 * automated message in the app — see automated_message on autoflow
 * steps), plus a push notification. Never throws — a failed send here
 * shouldn't break the check-in submission it's attached to.
 */
export async function sendAutomatedCheckinMessage(
  admin: SupabaseClient,
  params: { coachId: string; clientId: string; body: string },
): Promise<void> {
  const { coachId, clientId, body } = params
  try {
    const { data: convo } = await admin
      .from('conversations')
      .upsert({ coach_id: coachId, client_id: clientId }, { onConflict: 'coach_id,client_id', ignoreDuplicates: false })
      .select('id')
      .single()
    if (!convo?.id) return

    await admin.from('messages').insert({ conversation_id: convo.id, sender_id: coachId, body })
    await admin.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convo.id)

    const { sendPushToUser } = await import('@/lib/push')
    await sendPushToUser(clientId, {
      title: 'New message',
      body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
      url: '/messages',
      icon: '/icons/icon-192.png',
      tag: `message-${convo.id}`,
    })
  } catch (err) {
    console.error('sendAutomatedCheckinMessage error:', err)
  }
}
