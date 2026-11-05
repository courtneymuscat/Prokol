import { describe, it, expect } from 'vitest'
import { computeCheckinFlags, computeMissedCheckinFlag, requiredHistoryLength, DISORDERED_EATING_KEYWORDS, type CheckinQuestion } from '@/lib/checkinFlags'

function run(questions: CheckinQuestion[], recentAnswers: Record<string, string>[]) {
  return computeCheckinFlags({ questions, recentAnswers })
}

const PLAIN_TEXT_QUESTIONS: CheckinQuestion[] = [
  { id: 'biggest_win', type: 'textarea' },
  { id: 'biggest_obstacle', type: 'textarea' },
]

describe('threshold flag — two-in-a-row', () => {
  const q: CheckinQuestion = { id: 'energy_1_10', type: 'scale', label: 'Energy', flag: { severity: 'normal', condition: { kind: 'threshold', operator: '<=', value: 3, consecutive: 2 } } }

  it('flags when the value is <=3 two check-ins running', () => {
    const flags = run([q], [{ energy_1_10: '3' }, { energy_1_10: '2' }])
    expect(flags.find((f) => f.ruleKey === 'question:energy_1_10')).toBeTruthy()
  })

  it('does not flag a single low week', () => {
    const flags = run([q], [{ energy_1_10: '9' }, { energy_1_10: '2' }])
    expect(flags.find((f) => f.ruleKey === 'question:energy_1_10')).toBeFalsy()
  })

  it('does not flag when there is no previous check-in to compare against', () => {
    const flags = run([q], [{ energy_1_10: '1' }])
    expect(flags.find((f) => f.ruleKey === 'question:energy_1_10')).toBeFalsy()
  })
})

describe('threshold flag — single check-in', () => {
  const q: CheckinQuestion = { id: 'stress_1_10', type: 'scale', label: 'Stress', flag: { severity: 'normal', condition: { kind: 'threshold', operator: '>=', value: 8 } } }

  it('flags stress 8+', () => {
    expect(run([q], [{ stress_1_10: '8' }]).find((f) => f.ruleKey === 'question:stress_1_10')).toBeTruthy()
  })

  it('does not flag stress below 8', () => {
    expect(run([q], [{ stress_1_10: '7' }]).find((f) => f.ruleKey === 'question:stress_1_10')).toBeFalsy()
  })

  it('fires every time, not just the first time', () => {
    const flags = run([q], [{ stress_1_10: '9' }, { stress_1_10: '9' }])
    expect(flags.find((f) => f.ruleKey === 'question:stress_1_10')).toBeTruthy()
  })
})

describe('match flag', () => {
  const q: CheckinQuestion = { id: 'bonus_w5_rundown', type: 'radio', label: 'Run-down?', flag: { severity: 'normal', condition: { kind: 'match', values: ['Often'] } } }

  it('flags when the answer is in the trigger list', () => {
    expect(run([q], [{ bonus_w5_rundown: 'Often' }]).find((f) => f.ruleKey === 'question:bonus_w5_rundown')).toBeTruthy()
  })

  it('does not flag other values', () => {
    expect(run([q], [{ bonus_w5_rundown: 'Rarely' }]).find((f) => f.ruleKey === 'question:bonus_w5_rundown')).toBeFalsy()
  })

  it('does not flag when unanswered', () => {
    expect(run([q], [{}]).find((f) => f.ruleKey === 'question:bonus_w5_rundown')).toBeFalsy()
  })
})

describe('match flag — lead severity', () => {
  const q: CheckinQuestion = { id: 'what_next', type: 'radio', label: 'What next?', flag: { severity: 'lead', condition: { kind: 'match', values: ['Accountability Continuation', '1:1 coaching'] } } }

  it('flags Accountability Continuation as a lead', () => {
    const flag = run([q], [{ what_next: 'Accountability Continuation' }]).find((f) => f.ruleKey === 'question:what_next')
    expect(flag).toBeTruthy()
    expect(flag?.severity).toBe('lead')
  })

  it('flags 1:1 coaching as a lead', () => {
    expect(run([q], [{ what_next: '1:1 coaching' }]).find((f) => f.ruleKey === 'question:what_next')?.severity).toBe('lead')
  })

  it('does not flag "Keep going on my own"', () => {
    expect(run([q], [{ what_next: 'Keep going on my own' }]).find((f) => f.ruleKey === 'question:what_next')).toBeFalsy()
  })
})

describe('trend flag — weigh-in swing', () => {
  const q: CheckinQuestion = { id: 'weight_avg_kg', type: 'number', label: 'Weight', flag: { severity: 'normal', condition: { kind: 'trend', direction: 'either', amount: 1, consecutive: 2 } } }

  it('flags when two consecutive week-over-week deltas both exceed the amount', () => {
    const flags = run([q], [{ weight_avg_kg: '70' }, { weight_avg_kg: '71.5' }, { weight_avg_kg: '73' }])
    expect(flags.find((f) => f.ruleKey === 'question:weight_avg_kg')).toBeTruthy()
  })

  it('does not flag when only one delta exceeds the amount', () => {
    const flags = run([q], [{ weight_avg_kg: '70' }, { weight_avg_kg: '71.5' }, { weight_avg_kg: '71.8' }])
    expect(flags.find((f) => f.ruleKey === 'question:weight_avg_kg')).toBeFalsy()
  })

  it('does not flag with fewer data points than consecutive+1 requires', () => {
    const flags = run([q], [{ weight_avg_kg: '70' }, { weight_avg_kg: '73' }])
    expect(flags.find((f) => f.ruleKey === 'question:weight_avg_kg')).toBeFalsy()
  })

  it('respects direction filtering', () => {
    const increaseOnly: CheckinQuestion = { id: 'weight_avg_kg', type: 'number', flag: { severity: 'normal', condition: { kind: 'trend', direction: 'increase', amount: 1, consecutive: 2 } } }
    const flags = run([increaseOnly], [{ weight_avg_kg: '75' }, { weight_avg_kg: '73' }, { weight_avg_kg: '71' }])
    expect(flags.find((f) => f.ruleKey === 'question:weight_avg_kg')).toBeFalsy()
  })
})

describe('keyword scan rule (hardcoded, not coach-configurable)', () => {
  it('flags as urgent when a text answer contains a listed keyword', () => {
    const flags = run(PLAIN_TEXT_QUESTIONS, [{ biggest_obstacle: 'I have been purging after meals' }])
    const flag = flags.find((f) => f.ruleKey === 'keyword_match')
    expect(flag).toBeTruthy()
    expect(flag?.severity).toBe('urgent')
  })

  it('is case-insensitive', () => {
    const flags = run(PLAIN_TEXT_QUESTIONS, [{ biggest_win: 'Finally stopped PURGING this week' }])
    expect(flags.find((f) => f.ruleKey === 'keyword_match')).toBeTruthy()
  })

  it('does not scan non-text question types', () => {
    const flags = run([{ id: 'habit_days', type: 'number' }], [{ habit_days: 'purge' }])
    expect(flags.find((f) => f.ruleKey === 'keyword_match')).toBeFalsy()
  })

  it('does not flag clean text', () => {
    const flags = run(PLAIN_TEXT_QUESTIONS, [{ biggest_win: 'Felt strong in the gym this week' }])
    expect(flags.find((f) => f.ruleKey === 'keyword_match')).toBeFalsy()
  })

  it('keyword list is non-empty', () => {
    expect(DISORDERED_EATING_KEYWORDS.length).toBeGreaterThan(0)
  })
})

describe('requiredHistoryLength', () => {
  it('defaults to 1 when nothing has a flag', () => {
    expect(requiredHistoryLength(PLAIN_TEXT_QUESTIONS)).toBe(1)
  })

  it('returns the consecutive count for a threshold/match flag', () => {
    const q: CheckinQuestion = { id: 'x', type: 'scale', flag: { severity: 'normal', condition: { kind: 'threshold', operator: '<=', value: 3, consecutive: 2 } } }
    expect(requiredHistoryLength([q])).toBe(2)
  })

  it('returns consecutive+1 for a trend flag', () => {
    const q: CheckinQuestion = { id: 'x', type: 'number', flag: { severity: 'normal', condition: { kind: 'trend', direction: 'either', amount: 1, consecutive: 2 } } }
    expect(requiredHistoryLength([q])).toBe(3)
  })

  it('takes the max across every flagged question', () => {
    const a: CheckinQuestion = { id: 'a', type: 'scale', flag: { severity: 'normal', condition: { kind: 'threshold', operator: '<=', value: 3, consecutive: 2 } } }
    const b: CheckinQuestion = { id: 'b', type: 'number', flag: { severity: 'normal', condition: { kind: 'trend', direction: 'either', amount: 1, consecutive: 3 } } }
    expect(requiredHistoryLength([a, b])).toBe(4)
  })
})

describe('computeMissedCheckinFlag', () => {
  it('flags when the last two due steps both have no response', () => {
    const result = computeMissedCheckinFlag({
      scheduledStepNumbers: [1, 2, 3, 4],
      respondedStepNumbers: new Set([1]),
      dueStepNumbers: new Set([1, 2, 3]),
    })
    expect(result).toBeTruthy()
    expect(result?.stepNumber).toBe(3)
  })

  it('does not flag when only the most recent due step is missing', () => {
    const result = computeMissedCheckinFlag({
      scheduledStepNumbers: [1, 2, 3],
      respondedStepNumbers: new Set([1, 2]),
      dueStepNumbers: new Set([1, 2, 3]),
    })
    expect(result).toBeNull()
  })

  it('does not flag when both are submitted', () => {
    const result = computeMissedCheckinFlag({
      scheduledStepNumbers: [1, 2, 3],
      respondedStepNumbers: new Set([1, 2, 3]),
      dueStepNumbers: new Set([1, 2, 3]),
    })
    expect(result).toBeNull()
  })

  it('does not flag before at least 2 steps are due', () => {
    const result = computeMissedCheckinFlag({
      scheduledStepNumbers: [1, 2, 3],
      respondedStepNumbers: new Set(),
      dueStepNumbers: new Set([1]),
    })
    expect(result).toBeNull()
  })
})
