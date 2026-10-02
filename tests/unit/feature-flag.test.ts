import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const ORIGINAL = process.env.GYM_PARTNERSHIPS_ENABLED

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.GYM_PARTNERSHIPS_ENABLED
  else process.env.GYM_PARTNERSHIPS_ENABLED = ORIGINAL
})

describe('isGymPartnershipsEnabled', () => {
  it('is off when the env var is unset', async () => {
    delete process.env.GYM_PARTNERSHIPS_ENABLED
    const { isGymPartnershipsEnabled } = await import('@/lib/flags')
    expect(isGymPartnershipsEnabled()).toBe(false)
  })

  it('is off for any value other than the literal string "1"', async () => {
    process.env.GYM_PARTNERSHIPS_ENABLED = 'true'
    const { isGymPartnershipsEnabled } = await import('@/lib/flags')
    expect(isGymPartnershipsEnabled()).toBe(false)
  })

  it('is on when set to "1"', async () => {
    process.env.GYM_PARTNERSHIPS_ENABLED = '1'
    const { isGymPartnershipsEnabled } = await import('@/lib/flags')
    expect(isGymPartnershipsEnabled()).toBe(true)
  })
})

describe('master-templates publications route — flag gating', () => {
  beforeEach(() => {
    delete process.env.GYM_PARTNERSHIPS_ENABLED
  })

  it('POST returns 404 before touching auth/DB when the flag is off', async () => {
    const { POST } = await import('@/app/api/admin/master-templates/publications/route')
    const req = new NextRequest('http://localhost/api/admin/master-templates/publications', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('GET returns 404 when the flag is off', async () => {
    const { GET } = await import('@/app/api/admin/master-templates/publications/route')
    const req = new NextRequest('http://localhost/api/admin/master-templates/publications?org_id=x')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })
})
