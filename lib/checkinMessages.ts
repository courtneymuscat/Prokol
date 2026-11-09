import type { SupabaseClient } from '@supabase/supabase-js'
import { FLAG_CATEGORY_PRIORITY, FLAG_CATEGORY_LABELS } from '@/lib/checkinFlags'
import {
  DEFAULT_URGENT_TEMPLATE,
  DEFAULT_NORMAL_TEMPLATE,
  DEFAULT_LEAD_TEMPLATE,
  DEFAULT_CATEGORY_SNIPPETS,
  DEFAULT_MESSAGE_TEMPLATES,
  migrateSnippetsToReasonTip,
  type CoachMessageTemplates,
  type CustomFlagCategory,
} from '@/lib/checkinMessageTemplates'

// Server-only pieces of the automated check-in message system (DB reads/
// writes, push notifications) — kept separate from
// lib/checkinMessageTemplates.ts so client components can import the pure
// default-text/render helpers without pulling in Node-only dependencies
// (web-push, etc.) that break the browser bundle.
export { renderTemplate, combineCategorySnippets, type CoachMessageTemplates } from '@/lib/checkinMessageTemplates'

// The 6 built-in categories now live in each coach's own editable list
// (renamable, deletable, reorderable later if ever needed) rather than
// being a fixed global set — this fills in any that are missing so an
// older row (saved before this became editable) still shows them.
function withBuiltinsMerged(categories: CustomFlagCategory[]): CustomFlagCategory[] {
  const existingIds = new Set(categories.map((c) => c.id))
  const missingBuiltins = FLAG_CATEGORY_PRIORITY
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ id, label: FLAG_CATEGORY_LABELS[id] ?? id }))
  return [...missingBuiltins, ...categories]
}

// The Normal template before {flag_tip} existed — only auto-upgraded when
// a coach's saved text matches this exactly (never touched it), so a
// coach who customized their own wording never gets silently overwritten.
// They'd need to add {flag_tip} themselves in that case.
const LEGACY_NORMAL_TEMPLATE =
`Hi {first_name}, thanks for checking in. It looks like this week was a bit harder: {flag_reason}. That's okay, as progress is never a straight line.
If you'd like more support, message {coach_name} here in the app. And if something about your health is worrying you, please check in with your GP.`

/**
 * Fetches a coach's message-template row, creating it seeded with the
 * defaults on first access (every coach gets their own editable copy —
 * see lib/checkinFlags.ts for why the behaviour this drives is platform-
 * wide even though the wording itself is per-coach). Write-through: an
 * older row gets its missing built-in categories filled in, its
 * single-string category snippets split into {reason, tip}, and its
 * untouched legacy Normal template upgraded to include {flag_tip} — all
 * persisted back so every reader sees the same thing from here on, not
 * just this call.
 */
export async function getOrCreateMessageTemplates(admin: SupabaseClient, coachId: string): Promise<CoachMessageTemplates> {
  const { data: existing } = await admin
    .from('coach_message_templates')
    .select('urgent_template, urgent_enabled, normal_template, lead_template, category_snippets, custom_categories')
    .eq('coach_id', coachId)
    .maybeSingle()
  if (existing) {
    const mergedCategories = withBuiltinsMerged((existing.custom_categories as CustomFlagCategory[]) ?? [])
    const migratedSnippets = migrateSnippetsToReasonTip((existing.category_snippets as Record<string, unknown>) ?? {})
    const upgradedNormalTemplate = existing.normal_template === LEGACY_NORMAL_TEMPLATE ? DEFAULT_NORMAL_TEMPLATE : existing.normal_template

    const patch: Record<string, unknown> = {}
    if (mergedCategories.length !== (existing.custom_categories as CustomFlagCategory[] ?? []).length) patch.custom_categories = mergedCategories
    if (JSON.stringify(migratedSnippets) !== JSON.stringify(existing.category_snippets ?? {})) patch.category_snippets = migratedSnippets
    if (upgradedNormalTemplate !== existing.normal_template) patch.normal_template = upgradedNormalTemplate
    if (Object.keys(patch).length > 0) {
      await admin.from('coach_message_templates').update(patch).eq('coach_id', coachId)
    }

    return {
      ...existing,
      custom_categories: mergedCategories,
      category_snippets: migratedSnippets,
      normal_template: upgradedNormalTemplate,
    } as CoachMessageTemplates
  }

  const seeded = {
    coach_id: coachId,
    urgent_template: DEFAULT_URGENT_TEMPLATE,
    urgent_enabled: true,
    normal_template: DEFAULT_NORMAL_TEMPLATE,
    lead_template: DEFAULT_LEAD_TEMPLATE,
    category_snippets: DEFAULT_CATEGORY_SNIPPETS,
    custom_categories: withBuiltinsMerged([]),
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

    await admin.from('messages').insert({ conversation_id: convo.id, sender_id: coachId, body, is_automated: true })
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
