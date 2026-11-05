// Pure flag-computation for The Prokol Method check-in autoflow — kept
// dependency-free (no DB/network) so every rule is unit-testable in
// isolation. Two entry points:
//   - computeCheckinFlags: run against a single submission plus its recent
//     history, called right when a check-in is submitted.
//   - computeMissedCheckinFlag: run by a cron sweep, since "no check-in for
//     2 scheduled weeks in a row" has no submission to trigger off.

export type FlagSeverity = 'normal' | 'urgent' | 'lead'

export type FlagResult = {
  ruleKey: string
  severity: FlagSeverity
  reason: string
}

export type CheckinAnswers = Record<string, string>

export type CheckinQuestion = { id: string; type: string }

// Edit this list directly to add/remove trigger words — kept as one plain
// array, deliberately not spread across the file, so it's easy to find and
// change. Matches are case-insensitive substrings against every text/
// textarea answer on the submission being scored.
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

const LOW_MOOD_METRICS: { key: string; label: string }[] = [
  { key: 'overall_1_10', label: 'Overall' },
  { key: 'energy_1_10', label: 'Energy' },
  { key: 'sleep_quality_1_10', label: 'Sleep' },
]

/**
 * Scores one weekly/final check-in submission. `recentAnswers` is
 * chronological (oldest first) and must end with the submission being
 * scored — pass up to the last 3 so the weigh-in-swing rule (which needs
 * two week-over-week deltas) has enough history. A single-entry array is
 * fine for rules that only look at the current submission.
 */
export function computeCheckinFlags(params: {
  isFinalStep: boolean
  isWeek5BonusStep: boolean
  questions: CheckinQuestion[]
  recentAnswers: CheckinAnswers[]
}): FlagResult[] {
  const { isFinalStep, isWeek5BonusStep, questions, recentAnswers } = params
  if (recentAnswers.length === 0) return []

  const current = recentAnswers[recentAnswers.length - 1]
  const previous = recentAnswers.length >= 2 ? recentAnswers[recentAnswers.length - 2] : null
  const previousPrevious = recentAnswers.length >= 3 ? recentAnswers[recentAnswers.length - 3] : null

  const flags: FlagResult[] = []

  // Rule: overall/energy/sleep <= 3 in two consecutive check-ins
  if (previous) {
    const lowTwiceIn: string[] = []
    for (const m of LOW_MOOD_METRICS) {
      const c = toNumber(current[m.key])
      const p = toNumber(previous[m.key])
      if (c != null && p != null && c <= 3 && p <= 3) lowTwiceIn.push(m.label)
    }
    if (lowTwiceIn.length > 0) {
      flags.push({
        ruleKey: 'low_mood_two_weeks',
        severity: 'normal',
        reason: `${lowTwiceIn.join(', ')} ${lowTwiceIn.length > 1 ? 'were' : 'was'} 3/10 or below two check-ins in a row.`,
      })
    }
  }

  // Rule: habit days 0-1 in two consecutive check-ins
  if (previous) {
    const c = toNumber(current.habit_days)
    const p = toNumber(previous.habit_days)
    if (c != null && p != null && c <= 1 && p <= 1) {
      flags.push({
        ruleKey: 'habit_days_two_weeks',
        severity: 'normal',
        reason: 'Habit days were 0-1 two check-ins in a row.',
      })
    }
  }

  // Rule: stress 8+ (this check-in alone)
  const stress = toNumber(current.stress_1_10)
  if (stress != null && stress >= 8) {
    flags.push({
      ruleKey: 'high_stress',
      severity: 'normal',
      reason: `Stress was ${stress}/10 this week.`,
    })
  }

  // Rule: Week 5 bonus — period not regular, or often run-down/cold/sick/injured
  if (isWeek5BonusStep) {
    const periodRegular = current.bonus_w5_period_regular
    const rundown = current.bonus_w5_rundown
    const reasons: string[] = []
    if (periodRegular && periodRegular !== 'Yes' && periodRegular !== 'Not applicable') {
      reasons.push(`period regularity: ${periodRegular.toLowerCase()}`)
    }
    if (rundown === 'Often') {
      reasons.push('often run-down, cold, sick or injured')
    }
    if (reasons.length > 0) {
      flags.push({
        ruleKey: 'week5_energy_availability',
        severity: 'normal',
        reason: `Energy Availability bonus answers flagged: ${reasons.join('; ')}.`,
      })
    }
  }

  // Rule: weigh-in average changes by more than 1kg a week, 2+ weeks running
  if (previous && previousPrevious) {
    const w0 = toNumber(previousPrevious.weight_avg_kg)
    const w1 = toNumber(previous.weight_avg_kg)
    const w2 = toNumber(current.weight_avg_kg)
    if (w0 != null && w1 != null && w2 != null) {
      const delta1 = Math.abs(w1 - w0)
      const delta2 = Math.abs(w2 - w1)
      if (delta1 > 1 && delta2 > 1) {
        flags.push({
          ruleKey: 'weight_swing_two_weeks',
          severity: 'normal',
          reason: `Weigh-in average has moved more than 1 kg a week for two weeks running (${w0}kg → ${w1}kg → ${w2}kg).`,
        })
      }
    }
  }

  // Rule: keyword scan — any text/textarea answer on THIS submission
  const matchedKeyword = scanForKeyword(current, questions)
  if (matchedKeyword) {
    flags.push({
      ruleKey: 'keyword_match',
      severity: 'urgent',
      reason: `A written answer contained a word on the review list ("${matchedKeyword}"). Please read this check-in directly.`,
    })
  }

  // Rule: final check-in "what next" = a sales lead
  if (isFinalStep) {
    const whatNext = current.what_next
    if (whatNext === 'Accountability Continuation' || whatNext === '1:1 coaching') {
      flags.push({
        ruleKey: 'final_lead',
        severity: 'lead',
        reason: `Interested in what's next: ${whatNext}.`,
      })
    }
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
