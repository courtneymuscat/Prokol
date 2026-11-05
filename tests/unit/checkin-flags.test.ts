import { describe, it, expect } from 'vitest'
import { computeCheckinFlags, computeMissedCheckinFlag, DISORDERED_EATING_KEYWORDS } from '@/lib/checkinFlags'

const BASE_QUESTIONS = [
  { id: 'overall_1_10', type: 'scale' },
  { id: 'energy_1_10', type: 'scale' },
  { id: 'sleep_quality_1_10', type: 'scale' },
  { id: 'stress_1_10', type: 'scale' },
  { id: 'habit_days', type: 'number' },
  { id: 'weight_avg_kg', type: 'number' },
  { id: 'biggest_win', type: 'textarea' },
  { id: 'biggest_obstacle', type: 'textarea' },
]

function run(recentAnswers: Record<string, string>[], opts: Partial<{ isFinalStep: boolean; isWeek5BonusStep: boolean }> = {}) {
  return computeCheckinFlags({
    isFinalStep: opts.isFinalStep ?? false,
    isWeek5BonusStep: opts.isWeek5BonusStep ?? false,
    questions: BASE_QUESTIONS,
    recentAnswers,
  })
}

describe('low mood two-weeks-in-a-row rule', () => {
  it('flags when energy is <=3 two check-ins running', () => {
    const flags = run([{ energy_1_10: '3' }, { energy_1_10: '2' }])
    expect(flags.find((f) => f.ruleKey === 'low_mood_two_weeks')).toBeTruthy()
  })

  it('does not flag a single low week', () => {
    const flags = run([{ energy_1_10: '9' }, { energy_1_10: '2' }])
    expect(flags.find((f) => f.ruleKey === 'low_mood_two_weeks')).toBeFalsy()
  })

  it('does not flag when there is no previous check-in to compare against', () => {
    const flags = run([{ energy_1_10: '1' }])
    expect(flags.find((f) => f.ruleKey === 'low_mood_two_weeks')).toBeFalsy()
  })

  it('flags on overall or sleep too, not just energy', () => {
    expect(run([{ overall_1_10: '3' }, { overall_1_10: '1' }]).find((f) => f.ruleKey === 'low_mood_two_weeks')).toBeTruthy()
    expect(run([{ sleep_quality_1_10: '3' }, { sleep_quality_1_10: '3' }]).find((f) => f.ruleKey === 'low_mood_two_weeks')).toBeTruthy()
  })
})

describe('habit days two-weeks-in-a-row rule', () => {
  it('flags 0-1 habit days twice running', () => {
    const flags = run([{ habit_days: '1' }, { habit_days: '0' }])
    expect(flags.find((f) => f.ruleKey === 'habit_days_two_weeks')).toBeTruthy()
  })

  it('does not flag when one of the two weeks was fine', () => {
    const flags = run([{ habit_days: '5' }, { habit_days: '0' }])
    expect(flags.find((f) => f.ruleKey === 'habit_days_two_weeks')).toBeFalsy()
  })
})

describe('high stress rule', () => {
  it('flags stress 8+', () => {
    const flags = run([{ stress_1_10: '8' }])
    expect(flags.find((f) => f.ruleKey === 'high_stress')).toBeTruthy()
  })

  it('does not flag stress below 8', () => {
    const flags = run([{ stress_1_10: '7' }])
    expect(flags.find((f) => f.ruleKey === 'high_stress')).toBeFalsy()
  })

  it('fires every time stress is high, not just the first time', () => {
    const flags = run([{ stress_1_10: '9' }, { stress_1_10: '9' }])
    expect(flags.find((f) => f.ruleKey === 'high_stress')).toBeTruthy()
  })
})

describe('Week 5 energy availability bonus rule', () => {
  it('flags when period is not regular', () => {
    const flags = computeCheckinFlags({
      isFinalStep: false,
      isWeek5BonusStep: true,
      questions: BASE_QUESTIONS,
      recentAnswers: [{ bonus_w5_period_regular: 'No' }],
    })
    expect(flags.find((f) => f.ruleKey === 'week5_energy_availability')).toBeTruthy()
  })

  it('flags when often run-down/cold/sick/injured', () => {
    const flags = computeCheckinFlags({
      isFinalStep: false,
      isWeek5BonusStep: true,
      questions: BASE_QUESTIONS,
      recentAnswers: [{ bonus_w5_rundown: 'Often' }],
    })
    expect(flags.find((f) => f.ruleKey === 'week5_energy_availability')).toBeTruthy()
  })

  it('does not flag Not applicable or regular/rarely', () => {
    const flags = computeCheckinFlags({
      isFinalStep: false,
      isWeek5BonusStep: true,
      questions: BASE_QUESTIONS,
      recentAnswers: [{ bonus_w5_period_regular: 'Not applicable', bonus_w5_rundown: 'Rarely' }],
    })
    expect(flags.find((f) => f.ruleKey === 'week5_energy_availability')).toBeFalsy()
  })

  it('does not evaluate this rule outside the Week 5 bonus step', () => {
    const flags = run([{ bonus_w5_period_regular: 'No' }], { isWeek5BonusStep: false })
    expect(flags.find((f) => f.ruleKey === 'week5_energy_availability')).toBeFalsy()
  })
})

describe('weigh-in swing rule', () => {
  it('flags when two consecutive week-over-week deltas both exceed 1kg', () => {
    const flags = run([{ weight_avg_kg: '70' }, { weight_avg_kg: '71.5' }, { weight_avg_kg: '73' }])
    expect(flags.find((f) => f.ruleKey === 'weight_swing_two_weeks')).toBeTruthy()
  })

  it('does not flag when only one delta exceeds 1kg', () => {
    const flags = run([{ weight_avg_kg: '70' }, { weight_avg_kg: '71.5' }, { weight_avg_kg: '71.8' }])
    expect(flags.find((f) => f.ruleKey === 'weight_swing_two_weeks')).toBeFalsy()
  })

  it('does not flag with fewer than 3 weeks of weigh-ins', () => {
    const flags = run([{ weight_avg_kg: '70' }, { weight_avg_kg: '73' }])
    expect(flags.find((f) => f.ruleKey === 'weight_swing_two_weeks')).toBeFalsy()
  })
})

describe('keyword scan rule', () => {
  it('flags as urgent when a text answer contains a listed keyword', () => {
    const flags = run([{ biggest_obstacle: 'I have been purging after meals' }])
    const flag = flags.find((f) => f.ruleKey === 'keyword_match')
    expect(flag).toBeTruthy()
    expect(flag?.severity).toBe('urgent')
  })

  it('is case-insensitive', () => {
    const flags = run([{ biggest_win: 'Finally stopped PURGING this week' }])
    expect(flags.find((f) => f.ruleKey === 'keyword_match')).toBeTruthy()
  })

  it('does not scan non-text question types', () => {
    const flags = run([{ habit_days: 'purge' }]) // habit_days is type 'number', not scannable
    expect(flags.find((f) => f.ruleKey === 'keyword_match')).toBeFalsy()
  })

  it('does not flag clean text', () => {
    const flags = run([{ biggest_win: 'Felt strong in the gym this week' }])
    expect(flags.find((f) => f.ruleKey === 'keyword_match')).toBeFalsy()
  })

  it('keyword list is non-empty and editable (exported array)', () => {
    expect(DISORDERED_EATING_KEYWORDS.length).toBeGreaterThan(0)
  })
})

describe('final check-in lead rule', () => {
  it('flags Accountability Continuation as a lead', () => {
    const flags = run([{ what_next: 'Accountability Continuation' }], { isFinalStep: true })
    const flag = flags.find((f) => f.ruleKey === 'final_lead')
    expect(flag).toBeTruthy()
    expect(flag?.severity).toBe('lead')
  })

  it('flags 1:1 coaching as a lead', () => {
    const flags = run([{ what_next: '1:1 coaching' }], { isFinalStep: true })
    expect(flags.find((f) => f.ruleKey === 'final_lead')?.severity).toBe('lead')
  })

  it('does not flag "Keep going on my own"', () => {
    const flags = run([{ what_next: 'Keep going on my own' }], { isFinalStep: true })
    expect(flags.find((f) => f.ruleKey === 'final_lead')).toBeFalsy()
  })

  it('does not evaluate this rule outside the final step', () => {
    const flags = run([{ what_next: '1:1 coaching' }], { isFinalStep: false })
    expect(flags.find((f) => f.ruleKey === 'final_lead')).toBeFalsy()
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
