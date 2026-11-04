import { describe, it, expect } from 'vitest'
import { isDayOffsetUnlocked, dayOffsetAvailableDate } from '@/lib/autoflowUnlock'

// Covers the Prokol Method release rules: Week 0 Lesson 1 on Day 1, Week 1
// on Day 8 regardless of Week 0 progress, Weeks 2-12 every 7 days after
// that, and the final check-in on Day 91.
describe('Prokol Method release rules (day_offset unlock)', () => {
  const START = '2026-01-01' // "Day 1"

  it('Week 0 Lesson 1 (day_offset 0) is unlocked on Day 1 itself', () => {
    expect(isDayOffsetUnlocked(START, 0, new Date('2026-01-01T00:00:00Z'))).toBe(true)
  })

  it('Week 1 (day_offset 7, Day 8) stays locked through Day 7', () => {
    expect(isDayOffsetUnlocked(START, 7, new Date('2026-01-07T00:00:00Z'))).toBe(false)
  })

  it('Week 1 (day_offset 7, Day 8) unlocks exactly on Day 8', () => {
    expect(isDayOffsetUnlocked(START, 7, new Date('2026-01-08T00:00:00Z'))).toBe(true)
    expect(dayOffsetAvailableDate(START, 7)).toBe('2026-01-08')
  })

  it('Weeks 2-12 land every 7 days after Week 1 (Week 12 = Day 85)', () => {
    const weekDayOffsets = Array.from({ length: 12 }, (_, i) => 7 * (i + 1))
    const expectedDates = [
      '2026-01-08', '2026-01-15', '2026-01-22', '2026-01-29',
      '2026-02-05', '2026-02-12', '2026-02-19', '2026-02-26',
      '2026-03-05', '2026-03-12', '2026-03-19', '2026-03-26',
    ]
    weekDayOffsets.forEach((offset, i) => {
      expect(dayOffsetAvailableDate(START, offset)).toBe(expectedDates[i])
    })
  })

  it('final check-in (day_offset 90) lands on Day 91', () => {
    expect(dayOffsetAvailableDate(START, 90)).toBe('2026-04-01')
    expect(isDayOffsetUnlocked(START, 90, new Date('2026-03-31T00:00:00Z'))).toBe(false)
    expect(isDayOffsetUnlocked(START, 90, new Date('2026-04-01T00:00:00Z'))).toBe(true)
  })

  it('Week 1 unlocking does not depend on Week 0 completion — a day_offset step only checks the date', () => {
    // isDayOffsetUnlocked has no concept of other steps' completion at
    // all — it's pure date math, which is exactly the point: Week 1 is
    // never gated on whether Week 0's lessons were finished.
    expect(isDayOffsetUnlocked(START, 7, new Date('2026-01-08T00:00:00Z'))).toBe(true)
  })
})
