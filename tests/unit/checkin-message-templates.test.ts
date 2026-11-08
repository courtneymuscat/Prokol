import { describe, it, expect } from 'vitest'
import { combineCategorySnippets, migrateSnippetsToReasonTip, DEFAULT_CATEGORY_SNIPPETS } from '@/lib/checkinMessageTemplates'

describe('combineCategorySnippets', () => {
  const snippets = {
    high_stress: { reason: 'stress is high', tip: 'take 5 minutes' },
    low_habit: { reason: 'habit slipped', tip: 'pick one win' },
  }

  it('combines a single category', () => {
    expect(combineCategorySnippets(['high_stress'], snippets)).toEqual({ reason: 'stress is high', tip: 'take 5 minutes' })
  })

  it('combines two categories with the expected separators', () => {
    expect(combineCategorySnippets(['high_stress', 'low_habit'], snippets)).toEqual({
      reason: 'stress is high; habit slipped',
      tip: 'take 5 minutes pick one win',
    })
  })

  it('falls back to the built-in default when a coach has no snippet saved for a built-in category', () => {
    const result = combineCategorySnippets(['under_fuelling'], {})
    expect(result).toEqual(DEFAULT_CATEGORY_SNIPPETS.under_fuelling)
  })

  it('skips an empty tip rather than leaving a stray separator', () => {
    const withBlankTip = { high_stress: { reason: 'stress is high', tip: '' } }
    expect(combineCategorySnippets(['high_stress'], withBlankTip)).toEqual({ reason: 'stress is high', tip: '' })
  })
})

describe('migrateSnippetsToReasonTip', () => {
  it('splits an old single-string snippet on the em-dash', () => {
    const migrated = migrateSnippetsToReasonTip({ high_stress: 'stress is high — take 5 minutes' })
    expect(migrated.high_stress).toEqual({ reason: 'stress is high', tip: 'take 5 minutes' })
  })

  it('treats a string with no em-dash as reason-only, no data loss', () => {
    const migrated = migrateSnippetsToReasonTip({ custom: 'just a plain note' })
    expect(migrated.custom).toEqual({ reason: 'just a plain note', tip: '' })
  })

  it('leaves an already-migrated {reason, tip} object untouched', () => {
    const migrated = migrateSnippetsToReasonTip({ high_stress: { reason: 'a', tip: 'b' } })
    expect(migrated.high_stress).toEqual({ reason: 'a', tip: 'b' })
  })

  it('handles an empty input', () => {
    expect(migrateSnippetsToReasonTip({})).toEqual({})
  })
})
