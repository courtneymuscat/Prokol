import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_URGENT_TEMPLATE,
  DEFAULT_NORMAL_TEMPLATE,
  DEFAULT_LEAD_TEMPLATE,
  DEFAULT_CATEGORY_SNIPPETS,
  DEFAULT_MESSAGE_TEMPLATES,
  type CoachMessageTemplates,
} from '@/lib/checkinMessageTemplates'

// Server-only pieces of the automated check-in message system (DB reads/
// writes, push notifications) — kept separate from
// lib/checkinMessageTemplates.ts so client components can import the pure
// default-text/render helpers without pulling in Node-only dependencies
// (web-push, etc.) that break the browser bundle.
export { renderTemplate, combineCategorySnippets, type CoachMessageTemplates } from '@/lib/checkinMessageTemplates'

/**
 * Fetches a coach's message-template row, creating it seeded with the
 * defaults on first access (every coach gets their own editable copy —
 * see lib/checkinFlags.ts for why the behaviour this drives is platform-
 * wide even though the wording itself is per-coach).
 */
export async function getOrCreateMessageTemplates(admin: SupabaseClient, coachId: string): Promise<CoachMessageTemplates> {
  const { data: existing } = await admin
    .from('coach_message_templates')
    .select('urgent_template, urgent_enabled, normal_template, lead_template, category_snippets, custom_categories')
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
    custom_categories: [],
  }
  const { data: inserted } = await admin
    .from('coach_message_templates')
    .upsert(seeded, { onConflict: 'coach_id' })
    .select('urgent_template, urgent_enabled, normal_template, lead_template, category_snippets, custom_categories')
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
