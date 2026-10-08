import { describe, it, expect } from 'vitest'
import { INCLUDED_SEATS, INCLUDED_COACHES, CLIENT_OVERAGE_PRICE, COACH_OVERAGE_PRICE } from '@/lib/billing'

// INCLUDED_SEATS used to have no wl_starter/wl_pro entries at all, so
// GET /api/billing/info resolved included_seats to 0 for a white-label
// coach — which hid the entire seat-bar block in Billing & subscription
// (both Clients and Coaches bars are gated on included_seats > 0), even
// though INCLUDED_COACHES and WL_CLIENT_SEAT_CONFIG already had the right
// numbers elsewhere in this same file. Locks these in against the real
// (unmocked) module, matching the figures on the public pricing page
// (lib/features.ts) and WL_CLIENT_SEAT_CONFIG.
describe('lib/billing white-label seat constants', () => {
  it('has the real included-client counts for wl_starter and wl_pro', () => {
    expect(INCLUDED_SEATS.wl_starter).toBe(200)
    expect(INCLUDED_SEATS.wl_pro).toBe(500)
  })

  it('has the real included-coach counts for wl_starter and wl_pro', () => {
    expect(INCLUDED_COACHES.wl_starter).toBe(5)
    expect(INCLUDED_COACHES.wl_pro).toBe(10)
  })

  it('has the real overage rates for wl_starter', () => {
    expect(CLIENT_OVERAGE_PRICE.wl_starter).toBe(1.5)
    expect(COACH_OVERAGE_PRICE.wl_starter).toBe(15)
  })
})
