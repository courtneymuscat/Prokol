import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, subscription_tier, user_type')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.role !== 'platform_admin') {
    redirect('/dashboard')
  }

  return profile
}

export async function getPlatformStats() {
  const admin = createAdminClient()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    coachesRes,
    individualsRes,
    orgsRes,
    coachedRes,
    coachesByTierRes,
    signups7dRes,
    signups30dRes,
    trialsRes,
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'coach'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'individual'),
    admin.from('organisations').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_tier', 'coached'),
    admin.from('profiles').select('subscription_tier').eq('user_type', 'coach'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_type', 'coach')
      .not('stripe_subscription_id', 'is', null)
      .gte('created_at', fourteenDaysAgo),
  ])

  // Group coaches by tier
  const tierCounts: Record<string, number> = {}
  for (const row of coachesByTierRes.data ?? []) {
    const tier = row.subscription_tier ?? 'unknown'
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1
  }

  return {
    total_coaches: coachesRes.count ?? 0,
    total_individuals: individualsRes.count ?? 0,
    total_orgs: orgsRes.count ?? 0,
    total_coached_clients: coachedRes.count ?? 0,
    coaches_by_tier: tierCounts,
    new_signups_7d: signups7dRes.count ?? 0,
    new_signups_30d: signups30dRes.count ?? 0,
    active_trials: trialsRes.count ?? 0,
  }
}

export async function getAllCoaches(page = 1, limit = 50) {
  const admin = createAdminClient()
  const offset = (page - 1) * limit

  const { data: coaches, count } = await admin
    .from('profiles')
    .select('id, full_name, email, subscription_tier, stripe_customer_id, created_at, org_id', { count: 'exact' })
    .eq('user_type', 'coach')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!coaches) return { coaches: [], total: 0 }

  // Fetch org names and client counts in parallel
  const orgIds = [...new Set(coaches.filter(c => c.org_id).map(c => c.org_id as string))]
  const coachIds = coaches.map(c => c.id)

  const [orgsRes, clientCountsRes] = await Promise.all([
    orgIds.length > 0
      ? admin.from('organisations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [] }),
    admin
      .from('coach_clients')
      .select('coach_id')
      .in('coach_id', coachIds)
      .eq('status', 'active'),
  ])

  const orgMap: Record<string, string> = {}
  for (const org of orgsRes.data ?? []) {
    orgMap[org.id] = org.name
  }

  const clientCountMap: Record<string, number> = {}
  for (const row of clientCountsRes.data ?? []) {
    clientCountMap[row.coach_id] = (clientCountMap[row.coach_id] ?? 0) + 1
  }

  return {
    coaches: coaches.map(c => ({
      ...c,
      client_count: clientCountMap[c.id] ?? 0,
      org_name: c.org_id ? (orgMap[c.org_id] ?? null) : null,
    })),
    total: count ?? 0,
  }
}

export async function getAllOrgs(page = 1, limit = 50) {
  const admin = createAdminClient()
  const offset = (page - 1) * limit

  const { data: orgs, count } = await admin
    .from('organisations')
    .select('id, name, slug, subscription_tier, created_at, is_active, owner_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!orgs) return { orgs: [], total: 0 }

  const ownerIds = orgs.map(o => o.owner_id)
  const orgIds = orgs.map(o => o.id)

  const [ownersRes, membersRes, coachClientsRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').in('id', ownerIds),
    admin.from('org_members').select('org_id, user_id').in('org_id', orgIds).eq('is_active', true),
    admin.from('coach_clients').select('coach_id').eq('status', 'active'),
  ])

  const ownerMap: Record<string, { full_name: string | null; email: string | null }> = {}
  for (const owner of ownersRes.data ?? []) {
    ownerMap[owner.id] = { full_name: owner.full_name, email: owner.email }
  }

  // Count coaches per org
  const coachCountMap: Record<string, number> = {}
  const orgCoachIds: Record<string, string[]> = {}
  for (const member of membersRes.data ?? []) {
    coachCountMap[member.org_id] = (coachCountMap[member.org_id] ?? 0) + 1
    if (!orgCoachIds[member.org_id]) orgCoachIds[member.org_id] = []
    orgCoachIds[member.org_id].push(member.user_id)
  }

  // Count clients per org (sum across all coaches in org)
  const coachClientCountMap: Record<string, number> = {}
  for (const row of coachClientsRes.data ?? []) {
    coachClientCountMap[row.coach_id] = (coachClientCountMap[row.coach_id] ?? 0) + 1
  }
  const orgClientCountMap: Record<string, number> = {}
  for (const [orgId, coachIds] of Object.entries(orgCoachIds)) {
    orgClientCountMap[orgId] = coachIds.reduce((sum, cid) => sum + (coachClientCountMap[cid] ?? 0), 0)
  }

  return {
    orgs: orgs.map(o => ({
      ...o,
      owner_name: ownerMap[o.owner_id]?.full_name ?? null,
      owner_email: ownerMap[o.owner_id]?.email ?? null,
      coach_count: coachCountMap[o.id] ?? 0,
      client_count: orgClientCountMap[o.id] ?? 0,
    })),
    total: count ?? 0,
  }
}

const VALID_COACH_TIERS = ['coach_solo', 'coach_pro', 'coach_business'] as const
type CoachTier = typeof VALID_COACH_TIERS[number]

export async function updateCoachTier(coachId: string, newTier: string, adminId: string) {
  if (!VALID_COACH_TIERS.includes(newTier as CoachTier)) {
    return { error: 'Invalid coach tier' }
  }
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', coachId)
    .single()

  const { error } = await admin
    .from('profiles')
    .update({ subscription_tier: newTier })
    .eq('id', coachId)

  if (error) return { error: error.message }

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'update_coach_tier',
    target_user_id: coachId,
    old_value: current?.subscription_tier ?? null,
    new_value: newTier,
  })

  return { success: true }
}

export async function suspendAccount(userId: string, adminId: string, reason: string) {
  const admin = createAdminClient()

  const { error } = await admin
    .from('profiles')
    .update({ is_suspended: true, suspended_reason: reason })
    .eq('id', userId)

  if (error) return { error: error.message }

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'suspend_account',
    target_user_id: userId,
    new_value: reason,
  })

  return { success: true }
}
