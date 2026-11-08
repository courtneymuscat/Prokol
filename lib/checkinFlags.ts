// Flag-computation for autoflow check-ins (platform-wide — any coach, any
// autoflow, not just one template). Kept dependency-free (no DB/network) so
// every rule is unit-testable in isolation. computeCheckinFlags runs
// against a single submission plus its recent history, called right when
// any autoflow step is submitted. Evaluates the per-question `flag`
// config a coach set up in the autoflow builder, plus one rule that stays
// hardcoded on purpose (see below).
//
// See lib/checkinFlagsPersist.ts for what happens after a flag fires —
// including the automated client-facing message system, which reads
// `sendAutomatedMessage`/`category` off each flag.

export type FlagSeverity = 'normal' | 'urgent' | 'lead'

// Only meaningful for 'normal' severity flags — when more than one Normal
// flag fires on the same submission, the automated message combines the
// top 2 by priority order (see pickAutomatedMessages below). A plain
// string rather than a fixed union: coaches can add their own custom
// categories (with their own snippet text) from Check-ins > Message
// templates, on top of the built-in ones below. Built-ins always sort
// ahead of customs when combining — see pickAutomatedMessages.
export type FlagCategory = string

export const FLAG_CATEGORY_PRIORITY: FlagCategory[] = [
  'under_fuelling', 'low_mood_energy', 'high_stress', 'fast_weight_change', 'low_habit', 'missed_checkins',
]

export const FLAG_CATEGORY_LABELS: Record<string, string> = {
  under_fuelling: 'Under-fuelling',
  low_mood_energy: 'Low mood / energy',
  high_stress: 'High stress',
  fast_weight_change: 'Fast weight change',
  low_habit: 'Low habit adherence',
  missed_checkins: 'Missed check-ins',
}

export type FlagResult = {
  ruleKey: string
  severity: FlagSeverity
  reason: string
  // Whether this specific flag firing should feed the automated
  // client-facing message (as opposed to just notifying the coach).
  sendAutomatedMessage: boolean
  category?: FlagCategory | null
}

export type CheckinAnswers = Record<string, string>

export type FlagOperator = '<=' | '>=' | '='

export type FlagCondition =
  // Fires when this question's own answer satisfies the operator/value,
  // for `consecutive` check-ins in a row ending at the one just submitted
  // (consecutive defaults to 1 — "just this check-in").
  | { kind: 'threshold'; operator: FlagOperator; value: number; consecutive?: number }
  // Fires when the answer exactly matches one of `values`, for
  // `consecutive` check-ins in a row (default 1). Intended for
  // yesno/radio/choice/dropdown questions.
  | { kind: 'match'; values: string[]; consecutive?: number }
  // Fires when the value has moved by more than `amount` between each of
  // `consecutive` back-to-back check-ins (so `consecutive` deltas need
  // `consecutive + 1` data points). `direction` filters which way counts.
  | { kind: 'trend'; direction: 'increase' | 'decrease' | 'either'; amount: number; consecutive: number }

export type QuestionFlag = {
  severity: FlagSeverity
  condition: FlagCondition
  // Optional coach-written reason shown on the flag instead of the
  // auto-generated one.
  reason?: string | null
  // Opt this flag into the automated client-facing message (off by
  // default — a coach has to deliberately turn it on per question). For
  // 'normal' severity, `category` must also be set for the message to
  // actually combine in — see FLAG_CATEGORY_PRIORITY.
  sendAutomatedMessage?: boolean
  category?: FlagCategory | null
}

export type CheckinQuestion = { id: string; type: string; label?: string; flag?: QuestionFlag | null }

// Edit these lists directly to add/remove trigger words — kept as plain
// arrays, deliberately not spread across the file, so they're easy to
// find and change. Matches are case-insensitive substrings against every
// text/textarea answer on the submission being scored.
//
// This is the one rule that stays hardcoded rather than being a
// per-question `flag` a coach configures — it has to run identically
// across every text/textarea answer on every autoflow, not just one
// question, so there's nowhere sensible to attach it as a per-question
// setting. Shown read-only in the autoflow builder so a coach always
// knows it's active.
//
// Two tiers: URGENT_KEYWORDS covers genuine safety concerns (self-harm,
// disordered eating, acute mental-health distress, relationship/domestic
// safety) and triggers the Urgent automated message. NORMAL_KEYWORDS
// covers things worth a coach's attention but not a crisis response
// (compulsive exercise, burnout, bereavement) — these only ever surface
// as a plain flag for the coach, never an automated message to the
// client, since there's no single clean category to write client-facing
// text for a grief mention vs. an overtraining mention.
export const URGENT_KEYWORDS: string[] = [
  // Disordered eating
  'purge', 'purging', 'binge', 'bingeing', 'binging',
  'starve', 'starving', 'not eating', 'stopped eating',
  'restrict', 'restricting', 'restriction',
  'laxative', 'laxatives', 'make myself sick', 'making myself sick',
  'throw up', 'throwing up', 'vomit', 'vomiting',
  // Self-harm / suicide
  'self-harm', 'self harm', 'hurt myself', 'hurting myself',
  'suicide', 'suicidal', 'kill myself', 'end it all', 'unsafe',
  // Acute mental-health distress
  'depressed', 'depression', 'anxiety attack', 'panic attack',
  "can't cope", 'cant cope', 'breaking down', 'worthless', 'hopeless',
  'no point in anything', 'give up on everything',
  // Relationship / domestic safety
  'abusive', 'abused', 'scared of him', 'scared of her', 'hit me', 'unsafe at home',
]

export const NORMAL_KEYWORDS: string[] = [
  // Compulsive exercise / burnout
  'overtraining', "can't stop exercising", 'cant stop exercising',
  'exercising to punish myself', 'exercise addiction',
  "haven't slept in days", 'havent slept in days',
  "can't get out of bed", 'cant get out of bed',
  'completely burnt out', 'burnt out', 'burnout',
  // Bereavement / loss
  'passed away', 'death in the family', 'funeral', 'grieving', 'bereavement',
  'lost a family member', 'lost my dad', 'lost my mum', 'lost my mother', 'lost my father', 'lost my parent',
]

function toNumber(value: string | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function scanForKeyword(answers: CheckinAnswers, questions: CheckinQuestion[]): { severity: 'urgent' | 'normal'; keyword: string } | null {
  const textTypes = new Set(['text', 'textarea'])
  const textQuestionIds = new Set(questions.filter((q) => textTypes.has(q.type)).map((q) => q.id))
  const values = Object.entries(answers)
    .filter(([id]) => textQuestionIds.has(id))
    .map(([, raw]) => (raw ?? '').toLowerCase())
    .filter(Boolean)

  for (const val of values) {
    for (const kw of URGENT_KEYWORDS) {
      if (val.includes(kw)) return { severity: 'urgent', keyword: kw }
    }
  }
  for (const val of values) {
    for (const kw of NORMAL_KEYWORDS) {
      if (val.includes(kw)) return { severity: 'normal', keyword: kw }
    }
  }
  return null
}

function operatorWord(op: FlagOperator): string {
  return op === '<=' ? 'at or below' : op === '>=' ? 'at or above' : 'equal to'
}

/** How many total data points (current + history) a question's flag needs. */
function pointsNeeded(flag: QuestionFlag): number {
  if (flag.condition.kind === 'trend') return flag.condition.consecutive + 1
  return flag.condition.consecutive ?? 1
}

/**
 * The longest history any flag-configured question on this step needs —
 * use this to decide how many prior submissions to fetch before calling
 * computeCheckinFlags (see lib/checkinFlagsPersist.ts).
 */
export function requiredHistoryLength(questions: CheckinQuestion[]): number {
  let max = 1
  for (const q of questions) {
    if (q.flag) max = Math.max(max, pointsNeeded(q.flag))
  }
  return max
}

function evaluateCondition(
  condition: FlagCondition,
  questionId: string,
  recentAnswers: CheckinAnswers[],
): string | null {
  const points = condition.kind === 'trend' ? condition.consecutive + 1 : (condition.consecutive ?? 1)
  if (recentAnswers.length < points) return null
  const window = recentAnswers.slice(recentAnswers.length - points)

  if (condition.kind === 'threshold') {
    const values = window.map((a) => toNumber(a[questionId]))
    if (values.some((v) => v == null)) return null
    const ok = values.every((v) => {
      if (condition.operator === '<=') return (v as number) <= condition.value
      if (condition.operator === '>=') return (v as number) >= condition.value
      return v === condition.value
    })
    return ok ? String(values[values.length - 1]) : null
  }

  if (condition.kind === 'match') {
    const values = window.map((a) => a[questionId])
    if (values.some((v) => v == null || v === '')) return null
    const ok = values.every((v) => condition.values.includes(v))
    return ok ? values[values.length - 1] : null
  }

  // trend
  const numbers = window.map((a) => toNumber(a[questionId]))
  if (numbers.some((n) => n == null)) return null
  const deltas: number[] = []
  for (let i = 1; i < numbers.length; i++) deltas.push((numbers[i] as number) - (numbers[i - 1] as number))
  const ok = deltas.every((d) => {
    const magnitude = Math.abs(d)
    if (magnitude <= condition.amount) return false
    if (condition.direction === 'increase') return d > 0
    if (condition.direction === 'decrease') return d < 0
    return true
  })
  return ok ? numbers.map((n) => String(n)).join(' → ') : null
}

function autoReason(question: CheckinQuestion, condition: FlagCondition, matchedValue: string): string {
  const label = question.label ?? question.id
  if (condition.kind === 'threshold') {
    const streak = (condition.consecutive ?? 1) > 1 ? ` for ${condition.consecutive} check-ins in a row` : ' this check-in'
    return `"${label}" was ${operatorWord(condition.operator)} ${condition.value}${streak} (${matchedValue}).`
  }
  if (condition.kind === 'match') {
    const streak = (condition.consecutive ?? 1) > 1 ? ` for ${condition.consecutive} check-ins in a row` : ''
    return `"${label}" was answered "${matchedValue}"${streak}.`
  }
  return `"${label}" has moved by more than ${condition.amount} for ${condition.consecutive} check-ins running (${matchedValue}).`
}

/**
 * Scores one weekly/final check-in submission. `recentAnswers` is
 * chronological (oldest first) and must end with the submission being
 * scored — pass enough history to cover the longest `consecutive` window
 * any flag-configured question on this step needs (see
 * requiredHistoryLength). A single-entry array is fine if nothing needs
 * more.
 */
export function computeCheckinFlags(params: {
  questions: CheckinQuestion[]
  recentAnswers: CheckinAnswers[]
}): FlagResult[] {
  const { questions, recentAnswers } = params
  if (recentAnswers.length === 0) return []

  const current = recentAnswers[recentAnswers.length - 1]
  const flags: FlagResult[] = []

  for (const q of questions) {
    if (!q.flag) continue
    const matched = evaluateCondition(q.flag.condition, q.id, recentAnswers)
    if (matched == null) continue
    flags.push({
      ruleKey: `question:${q.id}`,
      severity: q.flag.severity,
      reason: q.flag.reason?.trim() || autoReason(q, q.flag.condition, matched),
      sendAutomatedMessage: q.flag.sendAutomatedMessage ?? false,
      category: q.flag.severity === 'normal' ? (q.flag.category ?? null) : null,
    })
  }

  // Keyword scan — any text/textarea answer on THIS submission. Hardcoded,
  // see URGENT_KEYWORDS/NORMAL_KEYWORDS above. Whether an urgent match
  // actually sends the automated Urgent message is controlled by the
  // coach's own urgent_enabled setting (see lib/checkinFlagsPersist.ts),
  // not here — this function stays DB-free. A normal-tier match never
  // sends an automated message (just flags for the coach) — there's no
  // single clean client-facing line that fits bereavement and
  // overtraining equally well.
  const keywordMatch = scanForKeyword(current, questions)
  if (keywordMatch?.severity === 'urgent') {
    flags.push({
      ruleKey: 'keyword_match',
      severity: 'urgent',
      reason: `A written answer contained a word on the review list ("${keywordMatch.keyword}"). Please read this check-in directly.`,
      sendAutomatedMessage: true,
    })
  } else if (keywordMatch?.severity === 'normal') {
    flags.push({
      ruleKey: 'keyword_match_normal',
      severity: 'normal',
      reason: `A written answer mentioned "${keywordMatch.keyword}" — worth a read, not urgent.`,
      sendAutomatedMessage: false,
    })
  }

  return flags
}

/**
 * Decides which automated client-facing message(s), if any, a submission's
 * flags should trigger. Priority: Urgent > Normal; Urgent suppresses Lead
 * (the Lead flag still gets recorded for the coach, just no message sent
 * for it). Lead sends as a separate message alongside Normal when both
 * fire and Urgent didn't. At most one Normal message — when several
 * Normal flags with a category fire, the top 2 by priority order combine
 * into one message.
 *
 * `categoryPriority` is the coach's own ordered category list (ids, top =
 * highest priority) — each coach can rename/reorder/delete categories
 * from Check-ins > Message templates, so this isn't a fixed global list
 * anymore. Defaults to FLAG_CATEGORY_PRIORITY (the seed order) when not
 * supplied, which keeps this function usable without DB access in tests.
 */
export function pickAutomatedMessages(
  flags: FlagResult[],
  categoryPriority: FlagCategory[] = FLAG_CATEGORY_PRIORITY,
): {
  urgent: FlagResult | null
  normal: { flags: FlagResult[] } | null
  lead: FlagResult | null
} {
  const sendable = flags.filter((f) => f.sendAutomatedMessage)
  const urgent = sendable.find((f) => f.severity === 'urgent') ?? null
  if (urgent) return { urgent, normal: null, lead: null }

  const lead = sendable.find((f) => f.severity === 'lead') ?? null

  const normalWithCategory = sendable.filter((f) => f.severity === 'normal' && f.category)
  let normal: { flags: FlagResult[] } | null = null
  if (normalWithCategory.length > 0) {
    // Dedupe by category (first occurrence wins), then take the top 2 by
    // priority order.
    const byCategory = new Map<FlagCategory, FlagResult>()
    for (const f of normalWithCategory) {
      const cat = f.category as FlagCategory
      if (!byCategory.has(cat)) byCategory.set(cat, f)
    }
    // Any category not in the priority list (e.g. the coach deleted it
    // after a flag was already set to use it) sorts after everything
    // recognized, rather than being dropped.
    const priorityIndex = (cat: FlagCategory) => {
      const idx = categoryPriority.indexOf(cat)
      return idx === -1 ? categoryPriority.length : idx
    }
    const ordered = [...byCategory.entries()]
      .sort((a, b) => priorityIndex(a[0]) - priorityIndex(b[0]))
      .map(([, f]) => f)
      .slice(0, 2)
    if (ordered.length > 0) normal = { flags: ordered }
  }

  return { urgent: null, normal, lead }
}
