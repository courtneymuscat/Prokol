import { describe, it, expect } from 'vitest'
import { hasOrgAreaAccess } from '@/lib/org'

// app/org/layout.tsx gates /org/setup and /org/white-label on this. It used
// to inline `subscription_tier !== 'coach_business'`, which locked a
// customer out of /org/white-label the instant they actually paid for
// white-label — their tier moves to wl_starter/wl_pro at that point, not
// 'coach_business' — sending a brand-new paying customer straight back to
// /pricing instead of the application form they just paid to reach.
describe('hasOrgAreaAccess', () => {
  it('allows coach_business', () => {
    expect(hasOrgAreaAccess('coach_business')).toBe(true)
  })

  it('allows wl_starter', () => {
    expect(hasOrgAreaAccess('wl_starter')).toBe(true)
  })

  it('allows wl_pro', () => {
    expect(hasOrgAreaAccess('wl_pro')).toBe(true)
  })

  it('rejects a non-business coach tier', () => {
    expect(hasOrgAreaAccess('coach_pro')).toBe(false)
  })

  it('rejects null/undefined', () => {
    expect(hasOrgAreaAccess(null)).toBe(false)
    expect(hasOrgAreaAccess(undefined)).toBe(false)
  })
})
