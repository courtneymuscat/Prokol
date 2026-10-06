import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgRole = 'owner' | 'admin' | 'coach'

const ROLE_RANK: Record<OrgRole, number> = {
  owner: 3,
  admin: 2,
  coach: 1,
}

export type OrgMembership = {
  org_id: string
  org_name: string
  org_slug: string
  role: OrgRole
}

export type OrgCoachPermissions = {
  can_view_all_clients: boolean
  can_reassign_clients: boolean
  can_use_org_templates: boolean
  can_message_all_clients: boolean
  can_view_org_analytics: boolean
}

const DEFAULT_PERMISSIONS: OrgCoachPermissions = {
  can_view_all_clients: false,
  can_reassign_clients: false,
  can_use_org_templates: true,
  can_message_all_clients: false,
  can_view_org_analytics: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) // leave room for collision suffix
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Returns the org membership for a user, or null if not in any org.
 */
export async function getOrgForUser(userId: string): Promise<OrgMembership | null> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('org_members')
    .select('org_id, role, organisations(name, slug)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!data) return null

  const org = data.organisations as unknown as { name: string; slug: string } | null
  if (!org) return null

  return {
    org_id: data.org_id as string,
    org_name: org.name,
    org_slug: org.slug,
    role: data.role as OrgRole,
  }
}

/**
 * Returns the org membership, throwing if the user is not in an org or does
 * not hold at least `minRole`.
 */
export async function requireOrgRole(userId: string, minRole: OrgRole): Promise<OrgMembership> {
  const membership = await getOrgForUser(userId)

  if (!membership) {
    throw new Error('Not a member of any organisation')
  }

  if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new Error(`Requires ${minRole} role or higher (current: ${membership.role})`)
  }

  return membership
}

/**
 * Returns the permission record for a coach within an org.
 * Falls back to default permissions if no record has been created yet.
 */
export async function getCoachPermissions(
  coachId: string,
  orgId: string,
): Promise<OrgCoachPermissions> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('org_coach_permissions')
    .select(
      'can_view_all_clients, can_reassign_clients, can_use_org_templates, can_message_all_clients, can_view_org_analytics',
    )
    .eq('coach_id', coachId)
    .eq('org_id', orgId)
    .single()

  if (!data) return { ...DEFAULT_PERMISSIONS }

  return {
    can_view_all_clients: data.can_view_all_clients,
    can_reassign_clients: data.can_reassign_clients,
    can_use_org_templates: data.can_use_org_templates,
    can_message_all_clients: data.can_message_all_clients,
    can_view_org_analytics: data.can_view_org_analytics,
  }
}

/**
 * Returns true if the given template (in `table`) is an org template
 * belonging to the specified org.
 */
export async function isOrgTemplate(
  templateId: string,
  table: 'autoflow_templates' | 'programs' | 'meal_plans' | 'forms' | 'note_templates',
  orgId: string,
): Promise<boolean> {
  const admin = createAdminClient()

  const { data } = await admin
    .from(table)
    .select('is_org_template, org_id')
    .eq('id', templateId)
    .single()

  return !!(data?.is_org_template && data?.org_id === orgId)
}

export type OrgTemplateTable =
  | 'autoflow_templates'
  | 'programs'
  | 'meal_plans'
  | 'forms'
  | 'note_templates'
  | 'coach_services'
  | 'coach_resources'

/**
 * Resolves which user's data should back this coach's "shared at org level"
 * resources (currently the food cheat sheet). For org members the owner is
 * authoritative — invited coaches see the owner's customisations and can't
 * mutate them. For solo coaches and org owners themselves this returns their
 * own id.
 *
 * Returns { userId, isMember } where isMember is true when the resolved id
 * is an org owner that's *not* the caller — so callers can use it to gate
 * write endpoints.
 */
export async function resolveOrgSharedUserId(
  coachId: string,
): Promise<{ userId: string; isMember: boolean; orgName: string | null }> {
  const membership = await getOrgForUser(coachId)
  if (!membership || membership.role === 'owner') {
    return { userId: coachId, isMember: false, orgName: membership?.org_name ?? null }
  }
  // Member coach — find the org owner
  const admin = createAdminClient()
  const { data: owner } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', membership.org_id)
    .eq('role', 'owner')
    .maybeSingle()
  if (!owner?.user_id) return { userId: coachId, isMember: false, orgName: membership.org_name }
  return { userId: owner.user_id as string, isMember: true, orgName: membership.org_name }
}

/**
 * Fetches org-published templates from `table` that the given coach can see,
 * applying coach-level exclusions. Returns [] if the user is not in an org or
 * (for non-admin members) doesn't have `can_use_org_templates` enabled.
 *
 * Each row is selected via the supplied `selectFields` so callers can reuse
 * the helper across content tables (autoflows, forms, programs, etc.) and
 * project the columns they need.
 */
export async function fetchOrgTemplatesForCoach<T extends { id: string }>(
  coachId: string,
  table: OrgTemplateTable,
  selectFields: string,
): Promise<T[]> {
  const membership = await getOrgForUser(coachId)
  if (!membership) return []

  if (membership.role === 'coach') {
    const perms = await getCoachPermissions(coachId, membership.org_id)
    if (!perms.can_use_org_templates) return []
  }

  const admin = createAdminClient()
  // The four primary template tables now carry archived_at — exclude
  // archived rows from org template listings too. Tables that don't
  // have that column (e.g. coach_services, coach_resources) still
  // accept the filter against a missing column gracefully if the
  // column doesn't exist? No — they'd error. So branch.
  const tablesWithArchive = new Set(['programs', 'meal_plans', 'autoflow_templates', 'forms'])
  let itemsQuery = admin
    .from(table)
    .select(selectFields)
    .eq('org_id', membership.org_id)
    .eq('is_org_template', true)
  if (tablesWithArchive.has(table)) {
    itemsQuery = itemsQuery.is('archived_at', null)
  }
  const [{ data: items }, exclusionsRes] = await Promise.all([
    itemsQuery.order('created_at', { ascending: false }),
    membership.role === 'coach'
      ? admin
          .from('org_template_exclusions')
          .select('template_id')
          .eq('org_id', membership.org_id)
          .eq('coach_id', coachId)
          .eq('template_table', table)
      : Promise.resolve({ data: [] as { template_id: string }[] }),
  ])

  const excluded = new Set(((exclusionsRes.data as { template_id: string }[] | null) ?? []).map((e) => e.template_id))
  return ((items as unknown) as T[] ?? []).filter((t) => !excluded.has(t.id))
}

// ─── Org template editor context ──────────────────────────────────────────────

export type OrgTemplateContext = {
  // True when the viewer is editing a row that is published to their org and
  // their role lets them edit it (owner/admin). Editors should show a banner.
  publishingToOrg: boolean
  orgName: string | null
  // Other coaches who will see the changes (org member count minus the viewer).
  sharedCoachCount: number
  // Set when this row was cloned from an org template that still exists and is
  // still published to the same org. Editors should show a subtitle.
  copiedFromOrgTemplate:
    | { id: string; name: string; orgName: string | null }
    | null
}

const NAME_FIELD: Record<OrgTemplateTable, string> = {
  autoflow_templates: 'name',
  programs: 'name',
  meal_plans: 'name',
  forms: 'title',
  note_templates: 'name',
  coach_services: 'name',
  coach_resources: 'name',
}

/**
 * Resolves the org-template editing context for a row: whether the viewer is
 * editing the org-shared version (publishingToOrg) and whether the row is a
 * personal copy of an org template (copiedFromOrgTemplate). Used by editors to
 * render banners and subtitles consistently across content types.
 */
export async function getOrgTemplateContext(
  viewerUserId: string,
  table: OrgTemplateTable,
  row: {
    id: string
    org_id?: string | null
    is_org_template?: boolean | null
    source_template_id?: string | null
  },
): Promise<OrgTemplateContext> {
  const membership = await getOrgForUser(viewerUserId)
  const admin = createAdminClient()
  const nameField = NAME_FIELD[table]

  // Publishing-to-org: this row is the org-shared version and viewer can edit
  // it on behalf of the org (owner or admin in the same org).
  let publishingToOrg = false
  let sharedCoachCount = 0
  if (
    membership &&
    (membership.role === 'owner' || membership.role === 'admin') &&
    row.is_org_template === true &&
    row.org_id === membership.org_id
  ) {
    publishingToOrg = true
    const { count } = await admin
      .from('org_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('org_id', membership.org_id)
      .neq('user_id', viewerUserId)
    sharedCoachCount = count ?? 0
  }

  // Copied-from-org: the source row still exists, is still published, and the
  // viewer is in the same org as the source (or no longer in any org — we
  // still show the subtitle since the copy reference is informative).
  let copiedFromOrgTemplate: OrgTemplateContext['copiedFromOrgTemplate'] = null
  if (row.source_template_id) {
    const { data: source } = await admin
      .from(table)
      .select(`id, ${nameField}, org_id, is_org_template`)
      .eq('id', row.source_template_id)
      .maybeSingle()
    const src = source as
      | (Record<string, unknown> & { id: string; org_id: string | null; is_org_template: boolean | null })
      | null
    if (src && src.is_org_template === true) {
      let orgName: string | null = null
      if (src.org_id) {
        const { data: org } = await admin
          .from('organisations')
          .select('name')
          .eq('id', src.org_id)
          .maybeSingle()
        orgName = (org as { name: string } | null)?.name ?? null
      }
      copiedFromOrgTemplate = {
        id: src.id,
        name: (src[nameField] as string | undefined) ?? 'Template',
        orgName,
      }
    }
  }

  return {
    publishingToOrg,
    orgName: membership?.org_name ?? null,
    sharedCoachCount,
    copiedFromOrgTemplate,
  }
}

// ─── Gym tenant support (Phase 1 foundation) ──────────────────────────────────
//
// A gym is an organisation row with tenant_type='gym' — it reuses every
// existing org mechanism (staff, seats, branding, RLS) but must NEVER grant
// health-data visibility to its staff, regardless of what org_coach_permissions
// says. These helpers enforce that as a hard rule, not a configurable toggle.

export type OrgTenantType = 'coaching_business' | 'gym'

/** Tables a master template can live in — matches the CHECK constraint on
 * master_template_publications.template_table. */
export type MasterLibraryTable = 'autoflow_templates' | 'programs' | 'meal_plans' | 'forms' | 'note_templates'

/**
 * Returns an org's tenant_type, or null if the org doesn't exist.
 */
export async function getOrgTenantType(orgId: string): Promise<OrgTenantType | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organisations')
    .select('tenant_type')
    .eq('id', orgId)
    .maybeSingle()
  return (data?.tenant_type as OrgTenantType | undefined) ?? null
}

/**
 * Same shape as getCoachPermissions, but hardcodes every health-data-shaped
 * grant to false when the org is a gym. A gym's staff have no per-client
 * coaching relationship to begin with — every member's program is automated
 * plus Court — so there's nothing configurable to turn on here. Template
 * usage and aggregate analytics stay configurable either way, since the
 * brief explicitly allows gym owners/staff to use templates and see
 * aggregate reports.
 */
export async function getEffectiveCoachPermissions(
  coachId: string,
  orgId: string,
): Promise<OrgCoachPermissions> {
  const [tenantType, base] = await Promise.all([
    getOrgTenantType(orgId),
    getCoachPermissions(coachId, orgId),
  ])

  if (tenantType === 'gym') {
    return {
      ...base,
      can_view_all_clients: false,
      can_reassign_clients: false,
      can_message_all_clients: false,
    }
  }

  return base
}

/**
 * True only when `userId` is a platform admin AND the template they're
 * trying to publish belongs to their own organisation. This is the entire
 * enforcement of "only Court can publish a master template into another
 * org" — no org (gym or otherwise) can publish its own templates elsewhere,
 * and a platform admin can't publish someone else's templates either.
 */
export async function canPublishMasterTemplate(
  userId: string,
  templateId: string,
  templateTable: MasterLibraryTable,
): Promise<boolean> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role, org_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || profile.role !== 'platform_admin' || !profile.org_id) return false

  const { data: template } = await admin
    .from(templateTable)
    .select('org_id')
    .eq('id', templateId)
    .maybeSingle()

  return !!template && (template as { org_id: string | null }).org_id === profile.org_id
}

export type MasterTemplatePublication = {
  id: string
  template_id: string
  template_table: MasterLibraryTable
  published_at: string
}

/**
 * Publishes a master template into a gym/org. Shared by the admin API
 * routes and the admin UI server actions so the permission rule
 * (canPublishMasterTemplate) only has one call site to get right.
 */
export async function publishMasterTemplate(
  adminUserId: string,
  templateId: string,
  templateTable: MasterLibraryTable,
  targetOrgId: string,
): Promise<{ data?: { id: string }; error?: string }> {
  const allowed = await canPublishMasterTemplate(adminUserId, templateId, templateTable)
  if (!allowed) return { error: 'Forbidden' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('master_template_publications')
    .insert({ template_id: templateId, template_table: templateTable, org_id: targetOrgId, published_by: adminUserId })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await admin.from('admin_audit_log').insert({
    admin_id: adminUserId,
    action: 'publish_master_template',
    target_org_id: targetOrgId,
    new_value: `${templateTable}:${templateId}`,
  })

  return { data }
}

/**
 * Unpublishes a master template from a gym/org. Platform-admin only —
 * RLS on master_template_publications enforces the same rule as
 * defense-in-depth.
 */
export async function unpublishMasterTemplate(
  adminUserId: string,
  publicationId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', adminUserId).maybeSingle()
  if (profile?.role !== 'platform_admin') return { error: 'Forbidden' }

  const { data: publication } = await admin
    .from('master_template_publications')
    .select('org_id, template_id, template_table')
    .eq('id', publicationId)
    .maybeSingle()

  const { error } = await admin.from('master_template_publications').delete().eq('id', publicationId)
  if (error) return { error: error.message }

  if (publication) {
    await admin.from('admin_audit_log').insert({
      admin_id: adminUserId,
      action: 'unpublish_master_template',
      target_org_id: publication.org_id,
      old_value: `${publication.template_table}:${publication.template_id}`,
    })
  }

  return {}
}

/** Lists every master template published to a given org. */
export async function listOrgPublications(orgId: string): Promise<MasterTemplatePublication[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('master_template_publications')
    .select('id, template_id, template_table, published_at')
    .eq('org_id', orgId)
    .order('published_at', { ascending: false })
  return (data as MasterTemplatePublication[] | null) ?? []
}

export type AssignableMasterTemplate = { id: string; name: string; total_steps: number }

/**
 * Name + length only — deliberately never includes questions, step titles,
 * or anything else that would let a gym coach learn the template's design
 * without a client actually answering it first. This is the only form in
 * which a gym coach is allowed to "see" a master template at all; they
 * can't browse into a detail/editor view the way they can for their own or
 * their org's templates.
 *
 * Default-off: a template being published to an org (master_template_publications)
 * does not by itself grant any coach in that org visibility — each coach
 * must be explicitly granted access via master_template_coach_access. This
 * is the opposite polarity of org_template_exclusions (a denylist).
 */
export async function fetchMasterTemplatesForCoach(orgId: string, coachId: string): Promise<AssignableMasterTemplate[]> {
  const admin = createAdminClient()

  const { data: grants } = await admin
    .from('master_template_coach_access')
    .select('template_id')
    .eq('org_id', orgId)
    .eq('coach_id', coachId)
    .eq('template_table', 'autoflow_templates')

  const templateIds = [...new Set((grants ?? []).map((g) => g.template_id as string))]
  if (templateIds.length === 0) return []

  const { data: templates } = await admin
    .from('autoflow_templates')
    .select('id, name, total_steps')
    .in('id', templateIds)
    .is('archived_at', null)

  return (templates as AssignableMasterTemplate[] | null) ?? []
}

/**
 * True when this specific coach has been granted access to this specific
 * master template within this org — the same check the enrollment route
 * uses to decide whether a POST can actually succeed, not just whether the
 * template shows up in the picker.
 */
export async function coachHasMasterTemplateAccess(
  templateId: string,
  templateTable: MasterLibraryTable,
  orgId: string,
  coachId: string,
): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('master_template_coach_access')
    .select('id')
    .eq('template_id', templateId)
    .eq('template_table', templateTable)
    .eq('org_id', orgId)
    .eq('coach_id', coachId)
    .maybeSingle()
  return !!data
}

/** Which coaches in an org currently have access to a given master template — used by the admin screen to render per-coach toggles. */
export async function listCoachGrantsForTemplate(
  templateId: string,
  templateTable: MasterLibraryTable,
  orgId: string,
): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('master_template_coach_access')
    .select('coach_id')
    .eq('template_id', templateId)
    .eq('template_table', templateTable)
    .eq('org_id', orgId)
  return (data ?? []).map((r) => r.coach_id as string)
}

/**
 * Grants one coach access to one master template within one org. Gated the
 * same way publishing is (canPublishMasterTemplate — platform admin,
 * publishing their own org's template) plus a check that the template was
 * actually published to this org in the first place; you can't grant
 * access to something that was never shared with the org at all.
 */
export async function grantMasterTemplateAccess(
  actorUserId: string,
  templateId: string,
  templateTable: MasterLibraryTable,
  orgId: string,
  coachId: string,
): Promise<{ error?: string }> {
  const allowed = await canPublishMasterTemplate(actorUserId, templateId, templateTable)
  if (!allowed) return { error: 'Forbidden' }

  const admin = createAdminClient()
  const { data: publication } = await admin
    .from('master_template_publications')
    .select('id')
    .eq('template_id', templateId)
    .eq('template_table', templateTable)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!publication) return { error: 'Not published to this org' }

  const { error } = await admin
    .from('master_template_coach_access')
    .upsert(
      { template_id: templateId, template_table: templateTable, org_id: orgId, coach_id: coachId, granted_by: actorUserId },
      { onConflict: 'template_id,template_table,org_id,coach_id' },
    )
  return error ? { error: error.message } : {}
}

/** Revokes one coach's access. Same gating as grant. */
export async function revokeMasterTemplateAccess(
  actorUserId: string,
  templateId: string,
  templateTable: MasterLibraryTable,
  orgId: string,
  coachId: string,
): Promise<{ error?: string }> {
  const allowed = await canPublishMasterTemplate(actorUserId, templateId, templateTable)
  if (!allowed) return { error: 'Forbidden' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('master_template_coach_access')
    .delete()
    .eq('template_id', templateId)
    .eq('template_table', templateTable)
    .eq('org_id', orgId)
    .eq('coach_id', coachId)
  return error ? { error: error.message } : {}
}

/**
 * True when `viewerCoachId` is looking at a flow built on a template they
 * didn't create and that isn't shared to their own org the normal way — the
 * only way they could be looking at it is via master_template_publications.
 * Ordinary within-org sharing (same org_id, is_org_template) always returns
 * false here, and the template's real owner always returns false too — both
 * get full visibility, unaffected by this feature.
 */
export async function isMasterSourcedForViewer(
  templateId: string,
  templateOwnerCoachId: string,
  templateOrgId: string | null,
  templateIsOrgTemplate: boolean,
  viewerCoachId: string,
): Promise<boolean> {
  if (templateOwnerCoachId === viewerCoachId) return false

  const viewerMembership = await getOrgForUser(viewerCoachId)
  if (!viewerMembership) return false
  if (templateIsOrgTemplate && templateOrgId === viewerMembership.org_id) return false

  const admin = createAdminClient()
  const { data } = await admin
    .from('master_template_publications')
    .select('id')
    .eq('template_id', templateId)
    .eq('template_table', 'autoflow_templates')
    .eq('org_id', viewerMembership.org_id)
    .maybeSingle()

  return !!data
}

// ─── Org analytics (shared by the regular Business dashboard and Admin Mode) ──

export type OrgAnalytics = {
  total_active: number
  new_mtd: number
  cancels_mtd: number
  mtd_churn_pct: number
  net_growth_mtd: number
  clients_by_coach: { name: string; count: number }[]
  weekly: { label: string; total: number; new: number; churned: number; net: number; churn_pct: number }[]
}

function weekStart(date: Date): Date {
  const d = new Date(date)
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Growth/churn analytics for every coach who's an active member of `orgId`.
 * Used by the regular Business dashboard (the viewer's own org) and by
 * Admin Mode (either Court's own org, or any org she clicks into) — same
 * computation either way, just a different org_id driving it.
 */
export async function computeOrgAnalytics(orgId: string): Promise<OrgAnalytics> {
  const admin = createAdminClient()
  const now = new Date()
  const monthStart = dateStr(new Date(now.getFullYear(), now.getMonth(), 1))

  const { data: orgMembers } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const coachIds = (orgMembers ?? []).map((m) => m.user_id)
  if (!coachIds.length) {
    return { total_active: 0, new_mtd: 0, cancels_mtd: 0, mtd_churn_pct: 0, net_growth_mtd: 0, clients_by_coach: [], weekly: [] }
  }

  const [rowsRes, coachProfilesRes] = await Promise.all([
    admin
      .from('coach_clients')
      .select('coach_id, client_id, accepted_at, archived_at, status')
      .in('coach_id', coachIds)
      .in('status', ['active', 'archived']),
    admin.from('profiles').select('id, full_name, email').in('id', coachIds),
  ])

  const rows = rowsRes.data ?? []
  const coachMap = Object.fromEntries((coachProfilesRes.data ?? []).map((c) => [c.id, c.full_name ?? c.email ?? 'Unknown']))

  const totalActive = rows.filter((r) => r.status === 'active').length

  const byCoach: Record<string, number> = {}
  for (const r of rows) {
    if (r.status === 'active') byCoach[r.coach_id] = (byCoach[r.coach_id] ?? 0) + 1
  }
  const clientsByCoach = Object.entries(byCoach)
    .map(([id, count]) => ({ name: coachMap[id] ?? 'Unknown', count }))
    .sort((a, b) => b.count - a.count)

  const newMTD = rows.filter((r) => r.accepted_at && r.accepted_at >= monthStart).length
  const cancelsMTD = rows.filter((r) => r.archived_at && r.archived_at >= monthStart + 'T00:00:00').length
  const totalAtMonthStart = rows.filter(
    (r) => r.accepted_at && r.accepted_at < monthStart && (!r.archived_at || r.archived_at >= monthStart + 'T00:00:00'),
  ).length
  const mtdChurnPct = totalAtMonthStart > 0 ? Math.round((cancelsMTD / totalAtMonthStart) * 100) : 0

  const weekly = Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(weekStart(now), -(7 - i) * 7)
    const we = addDays(ws, 6)
    const wsStr = dateStr(ws)
    const weEnd = dateStr(we) + 'T23:59:59'
    const wsStart = wsStr + 'T00:00:00'

    const newC = rows.filter((r) => r.accepted_at && r.accepted_at >= wsStr && r.accepted_at <= weEnd).length
    const churned = rows.filter((r) => r.archived_at && r.archived_at >= wsStart && r.archived_at <= weEnd).length
    const totalAtStart = rows.filter(
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

  return {
    total_active: totalActive,
    new_mtd: newMTD,
    cancels_mtd: cancelsMTD,
    mtd_churn_pct: mtdChurnPct,
    net_growth_mtd: newMTD - cancelsMTD,
    clients_by_coach: clientsByCoach,
    weekly,
  }
}

// ─── Org leads (shared by the regular Business dashboard and Admin Mode) ──────

export type OrgLead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string
  status: string
  notes: string | null
  follow_up_done: boolean
  follow_up_date: string | null
  created_at: string
}

export type OrgLeadInput = {
  name: string
  email?: string | null
  phone?: string | null
  source?: string
  status?: string
  notes?: string | null
  follow_up_done?: boolean
  follow_up_date?: string | null
}

export async function listOrgLeads(orgId: string): Promise<OrgLead[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('leads')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createOrgLead(
  orgId: string,
  createdBy: string,
  input: OrgLeadInput,
): Promise<{ lead?: OrgLead; error?: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .insert({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source || 'other',
      status: input.status || 'new',
      notes: input.notes?.trim() || null,
      follow_up_done: input.follow_up_done ?? false,
      follow_up_date: input.follow_up_date || null,
      created_by: createdBy,
      org_id: orgId,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { lead: data }
}

export async function updateOrgLead(
  orgId: string,
  leadId: string,
  update: Partial<OrgLeadInput>,
): Promise<{ lead?: OrgLead; error?: string }> {
  const admin = createAdminClient()
  const allowed: (keyof OrgLeadInput)[] = [
    'name', 'email', 'phone', 'source', 'status', 'notes', 'follow_up_done', 'follow_up_date',
  ]
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in update) row[key] = update[key]
  }

  const { data, error } = await admin
    .from('leads')
    .update(row)
    .eq('id', leadId)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) return { error: error.message }
  return { lead: data }
}

export async function deleteOrgLead(orgId: string, leadId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('leads').delete().eq('id', leadId).eq('org_id', orgId)
  return error ? { error: error.message } : {}
}
