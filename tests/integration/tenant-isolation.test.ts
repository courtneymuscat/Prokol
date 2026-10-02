// Real RLS proof against the live Supabase project — not mocked. Creates two
// throwaway "gym" orgs + one auth user each, signs in as each user to get a
// real session (so Postgres actually enforces RLS, not the service role
// which bypasses it), and tears everything down in afterAll.
//
// Opt-in only (`npm run test:integration`) since it touches the live
// database, even though every fixture it creates is deleted afterward.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1'

describe.skipIf(!runIntegration)('tenant isolation (RLS)', () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const runId = Math.random().toString(36).slice(2, 10)

  let orgA: { id: string }
  let orgB: { id: string }
  let userA: { id: string; email: string; password: string }
  let userB: { id: string; email: string; password: string }
  let clientA: SupabaseClient
  let clientB: SupabaseClient
  let publicationId: string

  beforeAll(async () => {
    const password = `Test-${runId}-Pw1!`

    const [{ data: createdA }, { data: createdB }] = await Promise.all([
      admin.auth.admin.createUser({
        email: `rls-test-a-${runId}@example.invalid`,
        password,
        email_confirm: true,
      }),
      admin.auth.admin.createUser({
        email: `rls-test-b-${runId}@example.invalid`,
        password,
        email_confirm: true,
      }),
    ])
    if (!createdA.user || !createdB.user) throw new Error('Failed to create test users')
    userA = { id: createdA.user.id, email: createdA.user.email!, password }
    userB = { id: createdB.user.id, email: createdB.user.email!, password }

    const [{ data: insertedA, error: errA }, { data: insertedB, error: errB }] = await Promise.all([
      admin.from('organisations').insert({
        name: `RLS Test Gym A ${runId}`,
        slug: `rls-test-gym-a-${runId}`,
        owner_id: userA.id,
        tenant_type: 'gym',
      }).select('id').single(),
      admin.from('organisations').insert({
        name: `RLS Test Gym B ${runId}`,
        slug: `rls-test-gym-b-${runId}`,
        owner_id: userB.id,
        tenant_type: 'gym',
      }).select('id').single(),
    ])
    if (errA || errB || !insertedA || !insertedB) {
      throw new Error(`Failed to create test orgs: ${errA?.message} ${errB?.message}`)
    }
    orgA = insertedA
    orgB = insertedB

    const setupResults = await Promise.all([
      admin.from('org_members').insert({ org_id: orgA.id, user_id: userA.id, role: 'owner', accepted_at: new Date().toISOString(), is_active: true }),
      admin.from('org_members').insert({ org_id: orgB.id, user_id: userB.id, role: 'owner', accepted_at: new Date().toISOString(), is_active: true }),
      // Creating an auth user via the admin API does NOT auto-create a
      // profiles row in this app (that's done by application signup code,
      // not a DB trigger — confirmed via pg_trigger), so these must be
      // inserts, not updates. subscription_tier must be set explicitly —
      // the column's default ('tier_1') predates a tier-rename migration
      // and no longer satisfies the current CHECK constraint.
      admin.from('profiles').insert({ id: userA.id, email: userA.email, org_id: orgA.id, subscription_tier: 'individual_free' }),
      admin.from('profiles').insert({ id: userB.id, email: userB.email, org_id: orgB.id, subscription_tier: 'individual_free' }),
    ])
    const setupError = setupResults.find((r) => r.error)?.error
    if (setupError) throw new Error(`Test fixture setup failed: ${setupError.message}`)

    // A publication into org A only — created by the service role, standing
    // in for what Court's platform-admin publish route would do.
    const { data: pub } = await admin
      .from('master_template_publications')
      .insert({
        template_id: '00000000-0000-0000-0000-000000000000',
        template_table: 'autoflow_templates',
        org_id: orgA.id,
        published_by: userA.id, // arbitrary — FK just needs a real user id
      })
      .select('id')
      .single()
    publicationId = pub!.id

    const anon = async (email: string, pw: string) => {
      const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { error } = await c.auth.signInWithPassword({ email, password: pw })
      if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
      return c
    }
    ;[clientA, clientB] = await Promise.all([
      anon(userA.email, password),
      anon(userB.email, password),
    ])
  }, 30000)

  afterAll(async () => {
    await admin.from('master_template_publications').delete().eq('id', publicationId)
    await admin.from('org_members').delete().in('org_id', [orgA?.id, orgB?.id].filter(Boolean))
    await admin.from('organisations').delete().in('id', [orgA?.id, orgB?.id].filter(Boolean))
    await admin.from('profiles').delete().in('id', [userA?.id, userB?.id].filter(Boolean))
    if (userA?.id) await admin.auth.admin.deleteUser(userA.id)
    if (userB?.id) await admin.auth.admin.deleteUser(userB.id)
  })

  it('a gym org member can see their own org but not another gym org', async () => {
    const { data } = await clientA.from('organisations').select('id').eq('id', orgB.id)
    expect(data).toEqual([])

    const { data: own } = await clientA.from('organisations').select('id').eq('id', orgA.id)
    expect(own?.map((o) => o.id)).toEqual([orgA.id])
  })

  it('an org member can read a publication made to their own org', async () => {
    const { data } = await clientA.from('master_template_publications').select('id').eq('org_id', orgA.id)
    expect(data?.map((r) => r.id)).toContain(publicationId)
  })

  it('an org member cannot read a publication made to a different org', async () => {
    const { data } = await clientB.from('master_template_publications').select('id').eq('org_id', orgA.id)
    expect(data).toEqual([])
  })

  it('a non-platform-admin org owner cannot create a master template publication', async () => {
    const { error } = await clientA.from('master_template_publications').insert({
      template_id: '00000000-0000-0000-0000-000000000000',
      template_table: 'autoflow_templates',
      org_id: orgB.id, // even trying to publish into someone else's org
      published_by: userA.id,
    })
    // RLS should reject this — gym orgs (and coaching businesses) cannot
    // publish master templates; only Court's platform-admin account can.
    expect(error).not.toBeNull()
  })
})
