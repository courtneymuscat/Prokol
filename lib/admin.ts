import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { notifyClientsOfBrandingChange } from '@/lib/whitelabel'
import { WHITE_LABEL_COACH_SEAT_LIMIT, DEFAULT_COACH_SEAT_LIMIT } from '@/lib/billing'
import { slugify } from '@/lib/org'

export async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, subscription_tier, user_type, org_id')
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
    orgsByTenantTypeRes,
    coachedRes,
    coachesByTierRes,
    signups7dRes,
    signups30dRes,
    trialsRes,
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'coach'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'individual'),
    admin.from('organisations').select('id', { count: 'exact', head: true }),
    admin.from('organisations').select('tenant_type'),
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

  // Group orgs by tenant type (gym vs coaching business)
  const tenantTypeCounts: Record<string, number> = {}
  for (const row of orgsByTenantTypeRes.data ?? []) {
    const type = row.tenant_type ?? 'coaching_business'
    tenantTypeCounts[type] = (tenantTypeCounts[type] ?? 0) + 1
  }

  return {
    total_coaches: coachesRes.count ?? 0,
    total_individuals: individualsRes.count ?? 0,
    total_orgs: orgsRes.count ?? 0,
    orgs_by_tenant_type: tenantTypeCounts,
    total_coached_clients: coachedRes.count ?? 0,
    coaches_by_tier: tierCounts,
    new_signups_7d: signups7dRes.count ?? 0,
    new_signups_30d: signups30dRes.count ?? 0,
    active_trials: trialsRes.count ?? 0,
  }
}

function analyticsWeekStart(date: Date): Date {
  const d = new Date(date)
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function analyticsAddDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function analyticsDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export type PlatformWeeklyCount = { label: string; new: number }

export type PlatformAnalytics = {
  active_orgs: number
  active_gyms: number
  active_coaches: number
  active_white_label_orgs: number
  orgs_weekly: PlatformWeeklyCount[]
  gyms_weekly: PlatformWeeklyCount[]
  clients: {
    total_active: number
    new_mtd: number
    cancels_mtd: number
    mtd_churn_pct: number
    net_growth_mtd: number
    weekly: { label: string; total: number; new: number; churned: number; net: number; churn_pct: number }[]
  }
  clients_by_org: { name: string; count: number }[]
}

/**
 * The "Prokol umbrella" view — Admin Mode's top-level Analytics tab.
 * Multi-dimensional platform health: organisations, gyms specifically
 * (since that's the strategic focus), coaches, white-label adoption, and
 * client growth/churn broken down by organisation rather than by
 * individual coach. This is deliberately a different shape from
 * computeOrgAnalytics (lib/org.ts), which stays "one org's own business" —
 * used by the regular Business dashboard and the per-org Analytics tab
 * inside an org's own Admin Mode detail page, where breaking down by
 * individual coach still makes sense.
 *
 * Org/gym weekly counts are new-orgs-created-this-week only — there's no
 * deactivation timestamp on organisations (just a point-in-time is_active
 * flag), so an org-level "churned this week" figure isn't computable from
 * current data.
 */
export async function computePlatformAnalytics(): Promise<PlatformAnalytics> {
  const admin = createAdminClient()
  const now = new Date()
  const monthStart = analyticsDateStr(new Date(now.getFullYear(), now.getMonth(), 1))

  const [orgsRes, coachesRes, clientRowsRes] = await Promise.all([
    admin.from('organisations').select('id, name, tenant_type, is_active, is_white_label, created_at'),
    admin.from('profiles').select('id, org_id, full_name, email, is_suspended').eq('user_type', 'coach'),
    admin
      .from('coach_clients')
      .select('coach_id, client_id, accepted_at, archived_at, status')
      .in('status', ['active', 'archived']),
  ])

  const orgs = orgsRes.data ?? []
  const coaches = coachesRes.data ?? []
  const clientRows = clientRowsRes.data ?? []

  const activeOrgs = orgs.filter((o) => o.is_active)
  const activeGyms = activeOrgs.filter((o) => o.tenant_type === 'gym')
  const activeWhiteLabel = activeOrgs.filter((o) => o.is_white_label)
  const activeCoaches = coaches.filter((c) => !c.is_suspended)

  function weeklyNewCounts(createdDates: string[]): PlatformWeeklyCount[] {
    return Array.from({ length: 8 }, (_, i) => {
      const ws = analyticsAddDays(analyticsWeekStart(now), -(7 - i) * 7)
      const we = analyticsAddDays(ws, 6)
      const wsStr = analyticsDateStr(ws)
      const weEnd = analyticsDateStr(we) + 'T23:59:59'
      const newCount = createdDates.filter((d) => d >= wsStr && d <= weEnd).length
      return { label: ws.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }), new: newCount }
    })
  }

  const orgsWeekly = weeklyNewCounts(orgs.map((o) => o.created_at).filter((d): d is string => !!d))
  const gymsWeekly = weeklyNewCounts(
    orgs.filter((o) => o.tenant_type === 'gym').map((o) => o.created_at).filter((d): d is string => !!d),
  )

  // Client growth/churn — platform-wide, same math as before, just grouped
  // by organisation afterward instead of by individual coach.
  const totalActiveClients = clientRows.filter((r) => r.status === 'active').length
  const newMTD = clientRows.filter((r) => r.accepted_at && r.accepted_at >= monthStart).length
  const cancelsMTD = clientRows.filter((r) => r.archived_at && r.archived_at >= monthStart + 'T00:00:00').length
  const totalAtMonthStart = clientRows.filter(
    (r) => r.accepted_at && r.accepted_at < monthStart && (!r.archived_at || r.archived_at >= monthStart + 'T00:00:00'),
  ).length
  const mtdChurnPct = totalAtMonthStart > 0 ? Math.round((cancelsMTD / totalAtMonthStart) * 100) : 0

  const clientsWeekly = Array.from({ length: 8 }, (_, i) => {
    const ws = analyticsAddDays(analyticsWeekStart(now), -(7 - i) * 7)
    const we = analyticsAddDays(ws, 6)
    const wsStr = analyticsDateStr(ws)
    const weEnd = analyticsDateStr(we) + 'T23:59:59'
    const wsStart = wsStr + 'T00:00:00'

    const newC = clientRows.filter((r) => r.accepted_at && r.accepted_at >= wsStr && r.accepted_at <= weEnd).length
    const churned = clientRows.filter((r) => r.archived_at && r.archived_at >= wsStart && r.archived_at <= weEnd).length
    const totalAtStart = clientRows.filter(
      (r) => r.accepted_at && r.accepted_at < wsStr && (!r.archived_at || r.archived_at >= wsStart),
    ).length

    return {
      label: ws.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }),
      total: totalAtStart + newC,
      new: newC,
      churned,
      net: newC - churned,
      churn_pct: totalAtStart > 0 ? Math.round((churned / totalAtStart) * 100) : 0,
    }
  })

  // Active clients grouped by organisation — coaches with no org_id are
  // combined into one "Independent coaches" bucket rather than listed
  // individually, since the page is now org-centric.
  const orgNameById = Object.fromEntries(orgs.map((o) => [o.id, o.name]))
  const coachOrgById = Object.fromEntries(coaches.map((c) => [c.id, c.org_id]))

  const byOrg: Record<string, number> = {}
  let independentCount = 0
  for (const r of clientRows) {
    if (r.status !== 'active') continue
    const orgId = coachOrgById[r.coach_id]
    if (orgId) {
      byOrg[orgId] = (byOrg[orgId] ?? 0) + 1
    } else {
      independentCount++
    }
  }
  const clientsByOrg = Object.entries(byOrg)
    .map(([id, count]) => ({ name: orgNameById[id] ?? 'Unknown org', count }))
    .sort((a, b) => b.count - a.count)
  if (independentCount > 0) {
    clientsByOrg.push({ name: 'Independent coaches', count: independentCount })
  }

  return {
    active_orgs: activeOrgs.length,
    active_gyms: activeGyms.length,
    active_coaches: activeCoaches.length,
    active_white_label_orgs: activeWhiteLabel.length,
    orgs_weekly: orgsWeekly,
    gyms_weekly: gymsWeekly,
    clients: {
      total_active: totalActiveClients,
      new_mtd: newMTD,
      cancels_mtd: cancelsMTD,
      mtd_churn_pct: mtdChurnPct,
      net_growth_mtd: newMTD - cancelsMTD,
      weekly: clientsWeekly,
    },
    clients_by_org: clientsByOrg,
  }
}

export type ArchivedClientRow = {
  client_id: string
  client_name: string | null
  client_email: string | null
  archived_at: string | null
}

/**
 * Archived coach_clients for a set of coaches, grouped by coach_id. Shared
 * by getAllCoaches, getOrgDetail, and getCoachDetail so the query + client
 * profile lookup isn't copy-pasted three times.
 */
async function fetchArchivedClientsForCoaches(
  admin: ReturnType<typeof createAdminClient>,
  coachIds: string[],
): Promise<Record<string, ArchivedClientRow[]>> {
  if (coachIds.length === 0) return {}

  const { data: archivedRows } = await admin
    .from('coach_clients')
    .select('coach_id, client_id, archived_at')
    .in('coach_id', coachIds)
    .eq('status', 'archived')
    .order('archived_at', { ascending: false, nullsFirst: false })

  const clientIds = [...new Set((archivedRows ?? []).map((r) => r.client_id))]
  const clientProfilesRes = clientIds.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', clientIds)
    : { data: [] }
  const clientProfileMap: Record<string, { full_name: string | null; email: string | null }> = {}
  for (const p of clientProfilesRes.data ?? []) {
    clientProfileMap[p.id] = { full_name: p.full_name, email: p.email }
  }

  const byCoachId: Record<string, ArchivedClientRow[]> = {}
  for (const row of archivedRows ?? []) {
    if (!byCoachId[row.coach_id]) byCoachId[row.coach_id] = []
    byCoachId[row.coach_id].push({
      client_id: row.client_id,
      client_name: clientProfileMap[row.client_id]?.full_name ?? null,
      client_email: clientProfileMap[row.client_id]?.email ?? null,
      archived_at: row.archived_at,
    })
  }
  return byCoachId
}

export async function getAllCoaches(page = 1, limit = 50, independentOnly = false) {
  const admin = createAdminClient()
  const offset = (page - 1) * limit

  let query = admin
    .from('profiles')
    .select('id, full_name, email, subscription_tier, stripe_customer_id, created_at, org_id, coach_grace_until', { count: 'exact' })
    .eq('user_type', 'coach')

  if (independentOnly) {
    // "Independent" excludes coaches still in their 3-day post-removal grace
    // period — org_id is already null for them, but they haven't actually
    // left the umbrella of org-managed coaches yet.
    query = query
      .is('org_id', null)
      .or(`coach_grace_until.is.null,coach_grace_until.lt.${new Date().toISOString()}`)
  }

  const { data: coaches, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!coaches) return { coaches: [], total: 0 }

  // Fetch org names, client counts, and archived clients in parallel
  const orgIds = [...new Set(coaches.filter(c => c.org_id).map(c => c.org_id as string))]
  const coachIds = coaches.map(c => c.id)

  const [orgsRes, clientCountsRes, archivedByCoachId] = await Promise.all([
    orgIds.length > 0
      ? admin.from('organisations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [] }),
    admin
      .from('coach_clients')
      .select('coach_id')
      .in('coach_id', coachIds)
      .eq('status', 'active'),
    fetchArchivedClientsForCoaches(admin, coachIds),
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
      archived_clients: archivedByCoachId[c.id] ?? [],
    })),
    total: count ?? 0,
  }
}

export async function getAllOrgs(page = 1, limit = 50) {
  const admin = createAdminClient()
  const offset = (page - 1) * limit

  const { data: orgs, count } = await admin
    .from('organisations')
    .select('id, name, slug, subscription_tier, tenant_type, created_at, is_active, owner_id, is_white_label', { count: 'exact' })
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

// ─── Gym partnerships admin screen ────────────────────────────────────────────

export type OrgDetail = {
  id: string
  name: string
  slug: string
  tenant_type: 'coaching_business' | 'gym'
  billing_status: string
  subscription_tier: string
  is_active: boolean
  logo_url: string | null
  brand_colour: string | null
  brand_colour_secondary: string | null
  app_name: string | null
  created_at: string | null
  is_white_label: boolean
  white_label_tier: string | null
  support_email: string | null
  favicon_url: string | null
}

export type PendingWhiteLabelApplication = {
  id: string
  app_name: string
  brand_colour: string
  brand_colour_secondary: string | null
  logo_url: string | null
  favicon_url: string | null
  support_email: string
  requested_tier: string
  submitted_at: string | null
}

export type OrgMemberRow = {
  id: string
  user_id: string
  role: string
  is_active: boolean
  full_name: string | null
  email: string | null
}

export type PublicationWithGrants = {
  id: string
  template_id: string
  template_table: string
  published_at: string
  grantedCoachIds: string[]
}

/**
 * Everything the admin org-detail screen needs: the org itself, its
 * staff/members, which master templates have been published to it, any
 * pending white-label application, and archived clients belonging to its
 * member coaches.
 */
export async function getOrgDetail(orgId: string) {
  const admin = createAdminClient()

  const [{ data: org }, { data: members }, { data: pendingApp }] = await Promise.all([
    admin
      .from('organisations')
      .select('id, name, slug, tenant_type, billing_status, subscription_tier, is_active, logo_url, brand_colour, brand_colour_secondary, app_name, created_at, is_white_label, white_label_tier, support_email, favicon_url')
      .eq('id', orgId)
      .single(),
    admin
      .from('org_members')
      .select('id, user_id, role, is_active')
      .eq('org_id', orgId)
      .order('role'),
    admin
      .from('white_label_applications')
      .select('id, app_name, brand_colour, brand_colour_secondary, logo_url, favicon_url, support_email, requested_tier, submitted_at')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Fetched separately rather than via an embedded `profiles(...)` join —
  // org_members.user_id has no FK PostgREST can discover against public
  // profiles (it's keyed to auth.users), so the embed silently errors and
  // returns null, which previously made every org look like it had zero
  // members (and, downstream, zero archived clients) regardless of the
  // actual data.
  const memberUserIds = (members ?? []).map((m) => m.user_id)
  const memberProfilesRes = memberUserIds.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', memberUserIds)
    : { data: [] }
  const memberProfileMap: Record<string, { full_name: string | null; email: string | null }> = {}
  for (const p of memberProfilesRes.data ?? []) {
    memberProfileMap[p.id] = { full_name: p.full_name, email: p.email }
  }

  const memberRows: OrgMemberRow[] = (members ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    is_active: m.is_active,
    full_name: memberProfileMap[m.user_id]?.full_name ?? null,
    email: memberProfileMap[m.user_id]?.email ?? null,
  }))

  const { listOrgPublications, listCoachGrantsForTemplate } = await import('@/lib/org')
  const rawPublications = await listOrgPublications(orgId)
  const publications = await Promise.all(
    rawPublications.map(async (p) => ({
      ...p,
      grantedCoachIds: await listCoachGrantsForTemplate(p.template_id, p.template_table, orgId),
    })),
  )

  const coachIds = memberRows.map((m) => m.user_id)
  const archivedByCoachId = await fetchArchivedClientsForCoaches(admin, coachIds)
  // Flatten back into one list sorted by archived_at desc across every
  // coach in the org (the helper only sorts within each coach's own group).
  const archivedClients: ArchivedClientRow[] = Object.values(archivedByCoachId)
    .flat()
    .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''))

  return {
    org: org as OrgDetail | null,
    members: memberRows,
    publications,
    archivedClients,
    pendingWhiteLabelApplication: (pendingApp as PendingWhiteLabelApplication | null) ?? null,
  }
}

/**
 * Court's own autoflow templates — the only thing she can publish to
 * another org's library (see lib/org.ts canPublishMasterTemplate). Scoped
 * to autoflow_templates for now since that's what the 12-week track is
 * built on; the schema supports the other content types too, for later.
 */
export async function getPublishableTemplates(adminId: string): Promise<{ id: string; name: string }[]> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('org_id').eq('id', adminId).single()
  if (!profile?.org_id) return []

  const { data } = await admin
    .from('autoflow_templates')
    .select('id, name')
    .eq('org_id', profile.org_id)
    .is('archived_at', null)
    .order('name')

  return data ?? []
}

export async function setOrgTenantType(
  orgId: string,
  tenantType: 'coaching_business' | 'gym',
  adminId: string,
) {
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('organisations')
    .select('tenant_type')
    .eq('id', orgId)
    .single()

  const { error } = await admin
    .from('organisations')
    .update({ tenant_type: tenantType })
    .eq('id', orgId)

  if (error) return { error: error.message }

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'set_org_tenant_type',
    target_org_id: orgId,
    old_value: current?.tenant_type ?? null,
    new_value: tenantType,
  })

  return { success: true }
}

/**
 * Turns white-label off for an org — the approval flow is currently the
 * only thing that ever turns it on, so there was no way to undo that (e.g.
 * a gym cancelling, or Court resetting her own test org). Leaves
 * custom_domain, branding fields, logo etc. untouched so re-approving
 * later doesn't lose anything — just flips the flag and clears the tier.
 */
export async function revokeWhiteLabel(orgId: string, adminId: string) {
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('organisations')
    .select('white_label_tier')
    .eq('id', orgId)
    .single()

  const { error } = await admin
    .from('organisations')
    // Drops back to the Business coach allowance — white-label's higher
    // limit (5/10) shouldn't persist once the plan that paid for it is off.
    .update({ is_white_label: false, white_label_tier: null, coach_seat_limit: DEFAULT_COACH_SEAT_LIMIT })
    .eq('id', orgId)

  if (error) return { error: error.message }

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'revoke_white_label',
    target_org_id: orgId,
    old_value: current?.white_label_tier ?? null,
    new_value: null,
  })

  return { success: true }
}

/**
 * Turns white-label back on for an org that was previously revoked, without
 * making them reapply — their branding fields (logo, colours, domain) were
 * never cleared by revokeWhiteLabel, so this just restores the flag + tier.
 * The tier comes from their own most recent approved application, not a
 * guess, since revoking nulls organisations.white_label_tier.
 */
export async function reinstateWhiteLabel(orgId: string, adminId: string) {
  const admin = createAdminClient()

  const { data: app } = await admin
    .from('white_label_applications')
    .select('requested_tier')
    .eq('org_id', orgId)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!app) {
    return { error: 'No approved white-label application found for this org — nothing to reinstate.' }
  }

  const { error } = await admin
    .from('organisations')
    .update({
      is_white_label: true,
      white_label_tier: app.requested_tier,
      coach_seat_limit: WHITE_LABEL_COACH_SEAT_LIMIT[app.requested_tier as 'starter' | 'pro'],
    })
    .eq('id', orgId)

  if (error) return { error: error.message }

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'reinstate_white_label',
    target_org_id: orgId,
    old_value: null,
    new_value: app.requested_tier,
  })

  await notifyClientsOfBrandingChange(orgId).catch((err) =>
    console.error('[reinstateWhiteLabel] notifyClientsOfBrandingChange failed:', err),
  )

  return { success: true }
}

/**
 * Full reset — deletes every white_label_applications row for the org and
 * clears every white-label field on organisations, back to how it looked
 * before the org ever applied. Unlike revokeWhiteLabel (reversible,
 * branding stays saved for later), this is destructive and permanent: it
 * exists so Court can test the apply → pay → approve flow start to finish
 * on her own test org, or fully clear a gym partnership that fell through.
 */
export async function deleteWhiteLabelApplication(orgId: string, adminId: string) {
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .single()

  if (!org) return { error: 'Organisation not found.' }

  const { error: deleteError } = await admin
    .from('white_label_applications')
    .delete()
    .eq('org_id', orgId)

  if (deleteError) return { error: deleteError.message }

  const { error: updateError } = await admin
    .from('organisations')
    .update({
      is_white_label: false,
      white_label_tier: null,
      app_name: null,
      brand_colour: null,
      brand_colour_secondary: null,
      logo_url: null,
      favicon_url: null,
      app_icon_url: null,
      support_email: null,
      custom_domain: null,
      custom_domain_verified: false,
      coach_seat_limit: DEFAULT_COACH_SEAT_LIMIT,
    })
    .eq('id', orgId)

  if (updateError) return { error: updateError.message }

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'delete_white_label_application',
    target_org_id: orgId,
    old_value: org.name,
    new_value: null,
  })

  return { success: true }
}

// ─── Independent coach detail screen ───────────────────────────────────────

export type CoachDetailProfile = {
  id: string
  full_name: string | null
  email: string | null
  subscription_tier: string | null
  stripe_customer_id: string | null
  created_at: string | null
  org_id: string | null
  org_name: string | null
  coach_grace_until: string | null
}

export type CoachActiveClientRow = {
  client_id: string
  client_name: string | null
  client_email: string | null
  tier: string | null
  joined_at: string | null
}

/**
 * A lightweight view of a single coach for Admin Mode — their own active
 * and archived clients, the same at-a-glance numbers they'd see on their
 * own Overview. Deliberately not a clone of the org Leads/Analytics tabs:
 * independent coaches don't have those concepts in their own dashboard
 * either (both are org-owner-only features).
 */
export async function getCoachDetail(coachId: string): Promise<{
  coach: CoachDetailProfile
  activeClients: CoachActiveClientRow[]
  archivedClients: ArchivedClientRow[]
} | null> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, subscription_tier, stripe_customer_id, created_at, org_id, coach_grace_until')
    .eq('id', coachId)
    .eq('user_type', 'coach')
    .maybeSingle()

  if (!profile) return null

  let orgName: string | null = null
  if (profile.org_id) {
    const { data: org } = await admin.from('organisations').select('name').eq('id', profile.org_id).maybeSingle()
    orgName = org?.name ?? null
  }

  const [{ data: activeRows }, archivedByCoachId] = await Promise.all([
    admin
      .from('coach_clients')
      .select('client_id, accepted_at')
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .order('accepted_at', { ascending: false }),
    fetchArchivedClientsForCoaches(admin, [coachId]),
  ])

  const clientIds = (activeRows ?? []).map((r) => r.client_id)
  const clientProfilesRes = clientIds.length
    ? await admin.from('profiles').select('id, full_name, email, subscription_tier').in('id', clientIds)
    : { data: [] }
  const clientProfileMap: Record<string, { full_name: string | null; email: string | null; subscription_tier: string | null }> = {}
  for (const p of clientProfilesRes.data ?? []) {
    clientProfileMap[p.id] = { full_name: p.full_name, email: p.email, subscription_tier: p.subscription_tier }
  }

  const activeClients: CoachActiveClientRow[] = (activeRows ?? []).map((r) => ({
    client_id: r.client_id,
    client_name: clientProfileMap[r.client_id]?.full_name ?? null,
    client_email: clientProfileMap[r.client_id]?.email ?? null,
    tier: clientProfileMap[r.client_id]?.subscription_tier ?? null,
    joined_at: r.accepted_at,
  }))

  return {
    coach: { ...profile, org_name: orgName },
    activeClients,
    archivedClients: archivedByCoachId[coachId] ?? [],
  }
}

export type CreateGymOrgParams = {
  name: string
  appName?: string | null
  brandColour?: string | null
  brandColourSecondary?: string | null
  logoUrl?: string | null
  faviconUrl?: string | null
  appIconUrl?: string | null
  supportEmail?: string | null
}

/**
 * Creates a gym organisation owned by the platform admin — used instead of
 * the self-serve app/api/org/setup/route.ts, which is hard-wired to the
 * calling session's own user id as both the subscription-tier gate subject
 * and owner_id, with no way to create an org for (or owned by) someone
 * else. A gym is just a normal organisation (tenant_type stays
 * 'coaching_business' — see lib/org.ts's gym-tenant-type comment for why
 * that stricter model isn't used here) marked white-label immediately,
 * with no Stripe/billing involved — these are Court's own businesses, not
 * self-serve customers going through the apply/approve/payment flow.
 */
export async function createGymOrg(
  params: CreateGymOrgParams,
  adminId: string,
): Promise<{ data?: { id: string; slug: string }; error?: string }> {
  const admin = createAdminClient()

  const name = params.name.trim()
  if (!name) return { error: 'Gym name is required' }

  let slug = slugify(name)
  const { data: existing } = await admin
    .from('organisations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data: org, error } = await admin
    .from('organisations')
    .insert({
      name,
      slug,
      owner_id: adminId,
      tenant_type: 'coaching_business',
      subscription_tier: 'org_enterprise',
      is_white_label: true,
      white_label_tier: 'starter',
      coach_seat_limit: WHITE_LABEL_COACH_SEAT_LIMIT.starter,
      app_name: params.appName ?? name,
      brand_colour: params.brandColour ?? null,
      brand_colour_secondary: params.brandColourSecondary ?? null,
      logo_url: params.logoUrl ?? null,
      favicon_url: params.faviconUrl ?? null,
      app_icon_url: params.appIconUrl ?? null,
      support_email: params.supportEmail ?? null,
    })
    .select('id, slug')
    .single()

  if (error || !org) return { error: error?.message ?? 'Failed to create gym organisation' }

  await admin.from('org_members').insert({
    org_id: org.id,
    user_id: adminId,
    role: 'owner',
    accepted_at: new Date().toISOString(),
    is_active: true,
  })

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'create_gym_org',
    target_org_id: org.id,
    new_value: name,
  })

  return { data: org }
}
