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
