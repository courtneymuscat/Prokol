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
  const [{ data: items }, exclusionsRes] = await Promise.all([
    admin
      .from(table)
      .select(selectFields)
      .eq('org_id', membership.org_id)
      .eq('is_org_template', true)
      .order('created_at', { ascending: false }),
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
