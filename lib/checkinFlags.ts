// Flag-computation for The Prokol Method check-in autoflow — kept
// dependency-free (no DB/network) so every rule is unit-testable in
// isolation. Two entry points:
//   - computeCheckinFlags: run against a single submission plus its recent
//     history, called right when a check-in is submitted. Evaluates the
//     per-question `flag` config a coach set up in the autoflow builder,
//     plus one rule that stays hardcoded on purpose (see below).
//   - computeMissedCheckinFlag: run by a cron sweep, since "no check-in for
//     2 scheduled weeks in a row" has no submission to trigger off.

export type FlagSeverity = 'normal' | 'urgent' | 'lead'

export type FlagResult = {
  ruleKey: string
  severity: FlagSeverity
  reason: string
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
}

export type CheckinQuestion = { id: string; type: string; label?: string; flag?: QuestionFlag | null }

// Edit this list directly to add/remove trigger words — kept as one plain
// array, deliberately not spread across the file, so it's easy to find and
// change. Matches are case-insensitive substrings against every text/
// textarea answer on the submission being scored.
//
// This is the one rule that stays hardcoded rather than being a
// per-question `flag` a coach configures — it has to run identically
// across every text/textarea answer on every autoflow, not just one
// question, so there's nowhere sensible to attach it as a per-question
// setting. Shown read-only in the autoflow builder so a coach always
// knows it's active.
export const DISORDERED_EATING_KEYWORDS: string[] = [
  'purge', 'purging', 'binge', 'bingeing', 'binging',
  'starve', 'starving', 'not eating', 'stopped eating',
  'restrict', 'restricting', 'restriction',
  'self-harm', 'self harm', 'hurt myself', 'hurting myself',
  'suicide', 'suicidal', 'kill myself', 'end it all',
  'unsafe', 'laxative', 'laxatives', 'make myself sick', 'making myself sick',
  'throw up', 'throwing up', 'vomit', 'vomiting',
]

function toNumber(value: string | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function scanForKeyword(answers: CheckinAnswers, questions: CheckinQuestion[]): string | null {
  const textTypes = new Set(['text', 'textarea'])
  const textQuestionIds = new Set(questions.filter((q) => textTypes.has(q.type)).map((q) => q.id))
  for (const [id, raw] of Object.entries(answers)) {
    if (!textQuestionIds.has(id)) continue
    const val = (raw ?? '').toLowerCase()
    if (!val) continue
    for (const kw of DISORDERED_EATING_KEYWORDS) {
      if (val.includes(kw)) return kw
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
    })
  }

  // Keyword scan — any text/textarea answer on THIS submission. Hardcoded,
  // see DISORDERED_EATING_KEYWORDS above.
  const matchedKeyword = scanForKeyword(current, questions)
  if (matchedKeyword) {
    flags.push({
      ruleKey: 'keyword_match',
      severity: 'urgent',
      reason: `A written answer contained a word on the review list ("${matchedKeyword}"). Please read this check-in directly.`,
    })
  }

  return flags
}

/**
 * Run by a cron sweep (no submission to trigger off). `scheduledStepNumbers`
 * must be the flow's weekly/final step numbers in schedule order (Week 0,
 * Week 1, ... Final), `respondedStepNumbers` the set that already has a
 * submission, and `dueStepNumbers` the set that's actually due as of today
 * (so we don't flag a week that hasn't arrived yet). Returns the missed
 * step number to flag, or null if fewer than 2 consecutive scheduled steps
 * in a row have been missed.
 */
export function computeMissedCheckinFlag(params: {
  scheduledStepNumbers: number[]
  respondedStepNumbers: Set<number>
  dueStepNumbers: Set<number>
}): { stepNumber: number; reason: string } | null {
  const { scheduledStepNumbers, respondedStepNumbers, dueStepNumbers } = params
  const dueSorted = scheduledStepNumbers.filter((n) => dueStepNumbers.has(n)).sort((a, b) => a - b)
  if (dueSorted.length < 2) return null

  const lastTwo = dueSorted.slice(-2)
  const bothMissed = lastTwo.every((n) => !respondedStepNumbers.has(n))
  if (!bothMissed) return null

  const latest = lastTwo[1]
  return {
    stepNumber: latest,
    reason: 'No check-in submitted for 2 scheduled weeks in a row.',
  }
}
