import type { FlagCategory } from '@/lib/checkinFlags'

// Pure, dependency-free pieces of the automated check-in message system —
// split out from lib/checkinMessages.ts so a client component (the
// autoflow builder's flag editor, for its live preview) can import the
// default text/render helpers without pulling in that file's server-only
// DB + push-notification code (which drags in Node-only deps that break
// the client bundle).
//
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

export type CustomFlagCategory = { id: string; label: string }

export type CoachMessageTemplates = {
  urgent_template: string
  urgent_enabled: boolean
  normal_template: string
  lead_template: string
  category_snippets: Record<string, string>
  // Coach-added categories on top of the 6 built-in ones in
  // lib/checkinFlags.ts — their snippet text lives in category_snippets
  // too, keyed by this id. Always lowest priority when combining (see
  // pickAutomatedMessages in lib/checkinFlags.ts).
  custom_categories: CustomFlagCategory[]
}

export const DEFAULT_MESSAGE_TEMPLATES: CoachMessageTemplates = {
  urgent_template: DEFAULT_URGENT_TEMPLATE,
  urgent_enabled: true,
  normal_template: DEFAULT_NORMAL_TEMPLATE,
  lead_template: DEFAULT_LEAD_TEMPLATE,
  category_snippets: DEFAULT_CATEGORY_SNIPPETS,
  custom_categories: [],
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
