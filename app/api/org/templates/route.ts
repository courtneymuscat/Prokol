import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole, getOrgForUser, getCoachPermissions } from '@/lib/org'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type TemplateTable =
  | 'autoflow_templates'
  | 'programs'
  | 'meal_plans'
  | 'forms'
  | 'note_templates'
  | 'coach_services'
  | 'coach_resources'
  | 'coach_saved_workouts'

const VALID_TABLES: TemplateTable[] = [
  'autoflow_templates',
  'programs',
  'meal_plans',
  'forms',
  'note_templates',
  'coach_services',
  'coach_resources',
  'coach_saved_workouts',
]

const EMPTY = { autoflows: [], programs: [], meal_plans: [], forms: [], note_templates: [], services: [], resources: [], saved_workouts: [] }

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const membership = await getOrgForUser(session.user.id)
  if (!membership) return Response.json({ error: 'Not a member of any organisation' }, { status: 403 })

  const admin = createAdminClient()

  // Non-admin coaches must have can_use_org_templates enabled
  let excludedTemplateIds: Record<string, Set<string>> = {}
  if (membership.role === 'coach') {
    const perms = await getCoachPermissions(session.user.id, membership.org_id)
    if (!perms.can_use_org_templates) return Response.json(EMPTY)

    // Build per-table exclusion sets for this coach
    const { data: exclusions } = await admin
      .from('org_template_exclusions')
      .select('template_id, template_table')
      .eq('org_id', membership.org_id)
      .eq('coach_id', session.user.id)

    for (const e of exclusions ?? []) {
      if (!excludedTemplateIds[e.template_table]) excludedTemplateIds[e.template_table] = new Set()
      excludedTemplateIds[e.template_table].add(e.template_id)
    }
  }

  const [autoflows, programs, mealPlans, forms, noteTemplates, services, resources, savedWorkouts] = await Promise.all([
    admin.from('autoflow_templates').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('programs').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('meal_plans').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('forms').select('id, name:title, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('note_templates').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('coach_services').select('id, name, price_label, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('coach_resources').select('id, name, type, url, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('coach_saved_workouts').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
  ])

  function filter<T extends { id: string }>(items: T[] | null, table: string): T[] {
    const excluded = excludedTemplateIds[table]
    if (!excluded?.size) return items ?? []
    return (items ?? []).filter((t) => !excluded.has(t.id))
  }

  // ── Build per-template "who has access" summary for admins ─────────────────
  // Owner sees all org members + per-template exclusions to compute who has
  // access to each template. Non-admin coaches don't need this — the admin
  // UI is gated by membership.role !== 'coach' anyway, but we still want to
  // return SOMETHING here so the request doesn't fail. For non-admins we
  // skip the work and return [] for everything.
  let accessByTemplate: Record<string, CoachInfo[]> = {}
  if (membership.role !== 'coach') {
    const [{ data: members }, { data: allExclusions }] = await Promise.all([
      admin
        .from('org_members')
        .select('user_id, role')
        .eq('org_id', membership.org_id)
        .eq('is_active', true),
      admin
        .from('org_template_exclusions')
        .select('template_id, template_table, coach_id')
        .eq('org_id', membership.org_id),
    ])

    const memberIds = (members ?? []).map((m) => m.user_id as string)
    const { data: profiles } = memberIds.length
      ? await admin.from('profiles').select('id, email, full_name, first_name').in('id', memberIds)
      : { data: [] as Array<{ id: string; email: string | null; full_name: string | null; first_name: string | null }> }

    const profileMap = new Map<string, { email: string | null; full_name: string | null; first_name: string | null }>()
    for (const p of profiles ?? []) profileMap.set(p.id, p)

    const memberByRole = new Map<string, string>() // user_id → role
    for (const m of members ?? []) memberByRole.set(m.user_id as string, (m.role as string) ?? 'coach')

    // Build {template_table → {template_id → Set<excluded_coach_id>}}
    const exclusionMap = new Map<string, Map<string, Set<string>>>()
    for (const e of allExclusions ?? []) {
      const tbl = e.template_table as string
      if (!exclusionMap.has(tbl)) exclusionMap.set(tbl, new Map())
      const inner = exclusionMap.get(tbl)!
      const set = inner.get(e.template_id as string) ?? new Set<string>()
      set.add(e.coach_id as string)
      inner.set(e.template_id as string, set)
    }

    function buildAccess(items: { id: string }[] | null, table: string): Record<string, CoachInfo[]> {
      const result: Record<string, CoachInfo[]> = {}
      const tableExcl = exclusionMap.get(table) ?? new Map<string, Set<string>>()
      for (const t of items ?? []) {
        const excluded = tableExcl.get(t.id) ?? new Set<string>()
        const list: CoachInfo[] = []
        for (const m of members ?? []) {
          const role = (m.role as string) ?? 'coach'
          // Admins/owners always have access; coaches have access unless excluded
          if (role === 'owner' || role === 'admin' || !excluded.has(m.user_id as string)) {
            const p = profileMap.get(m.user_id as string)
            const name = p?.full_name ?? p?.first_name ?? null
            const email = p?.email ?? null
            list.push({
              id: m.user_id as string,
              name,
              email,
              role,
              initial: deriveInitial(name, email),
            })
          }
        }
        result[t.id] = list
      }
      return result
    }

    accessByTemplate = {
      ...buildAccess(autoflows.data, 'autoflow_templates'),
      ...buildAccess(programs.data, 'programs'),
      ...buildAccess(mealPlans.data, 'meal_plans'),
      ...buildAccess(forms.data, 'forms'),
      ...buildAccess(noteTemplates.data, 'note_templates'),
      ...buildAccess(services.data, 'coach_services'),
      ...buildAccess(resources.data, 'coach_resources'),
      ...buildAccess(savedWorkouts.data, 'coach_saved_workouts'),
    }
  }

  return Response.json({
    autoflows: filter(autoflows.data, 'autoflow_templates'),
    programs: filter(programs.data, 'programs'),
    meal_plans: filter(mealPlans.data, 'meal_plans'),
    forms: filter(forms.data, 'forms'),
    note_templates: filter(noteTemplates.data, 'note_templates'),
    services: filter(services.data, 'coach_services'),
    resources: filter(resources.data, 'coach_resources'),
    saved_workouts: filter(savedWorkouts.data, 'coach_saved_workouts'),
    access: accessByTemplate,
  })
}

type CoachInfo = {
  id: string
  name: string | null
  email: string | null
  role: string
  initial: string
}

function deriveInitial(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
    return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try {
    membership = await requireOrgRole(session.user.id, 'admin')
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    template_id: string
    table: TemplateTable
    excluded_coach_ids?: string[]
  }
  const { template_id, table, excluded_coach_ids } = body

  if (!template_id) return Response.json({ error: 'template_id is required' }, { status: 400 })
  if (!VALID_TABLES.includes(table)) {
    return Response.json({ error: `table must be one of: ${VALID_TABLES.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from(table)
    .update({
      is_org_template: true,
      org_id: membership.org_id,
      created_by: session.user.id,
    })
    .eq('id', template_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // When publishing an autoflow, automatically share any forms or resources
  // its steps reference so the autoflow stays self-contained for invited
  // coaches and their clients. Without this, an org-published autoflow could
  // reference a private form/resource that breaks at use-time.
  if (table === 'autoflow_templates') {
    await autoPublishAutoflowDependencies(admin, template_id, membership.org_id, session.user.id)
  }

  // Apply per-coach exclusions if the admin chose to scope this to specific
  // coaches at publish time. We replace the existing exclusions for this
  // template entirely so re-publishing with a different selection gives the
  // expected result.
  await admin
    .from('org_template_exclusions')
    .delete()
    .eq('org_id', membership.org_id)
    .eq('template_id', template_id)
    .eq('template_table', table)

  if (Array.isArray(excluded_coach_ids) && excluded_coach_ids.length > 0) {
    const rows = excluded_coach_ids.map((coachId) => ({
      org_id: membership.org_id,
      template_id,
      template_table: table,
      coach_id: coachId,
    }))
    await admin.from('org_template_exclusions').insert(rows)
  }

  return Response.json({ ok: true })
}

async function autoPublishAutoflowDependencies(
  admin: ReturnType<typeof createAdminClient>,
  templateId: string,
  orgId: string,
  publisherId: string,
) {
  const { data: steps } = await admin
    .from('autoflow_template_steps')
    .select('form_id, resource_ids, tasks')
    .eq('template_id', templateId)

  if (!steps?.length) return

  const { formIds, resourceIds } = collectAutoflowDependencies(
    steps as Array<{ form_id: string | null; resource_ids: string[] | null; tasks: unknown }>,
  )

  if (formIds.size > 0) {
    // Only flip rows that aren't already org templates so we don't reassign
    // ownership of an existing org-shared row to this publisher.
    await admin
      .from('forms')
      .update({ is_org_template: true, org_id: orgId, created_by: publisherId })
      .in('id', [...formIds])
      .eq('is_org_template', false)
  }
  if (resourceIds.size > 0) {
    await admin
      .from('coach_resources')
      .update({ is_org_template: true, org_id: orgId, created_by: publisherId })
      .in('id', [...resourceIds])
      .eq('is_org_template', false)
  }
}

/**
 * Walk every step + every task on every step to collect form and resource IDs
 * referenced anywhere by an autoflow.
 *
 * Tasks store form references as `link_url: '/forms/<id>'` and resource
 * references as `link_type: 'resource'` with the resource id. We treat the
 * step-level `form_id` and `resource_ids` as authoritative and tasks as
 * supplementary so we don't miss any reference.
 */
export function collectAutoflowDependencies(
  steps: Array<{ form_id: string | null; resource_ids: string[] | null; tasks: unknown }>,
): { formIds: Set<string>; resourceIds: Set<string> } {
  const formIds = new Set<string>()
  const resourceIds = new Set<string>()
  for (const step of steps) {
    if (step.form_id) formIds.add(step.form_id)
    for (const r of step.resource_ids ?? []) resourceIds.add(r)
    for (const task of (Array.isArray(step.tasks) ? step.tasks : []) as Array<Record<string, unknown>>) {
      const linkType = task.link_type as string | undefined
      const linkUrl = task.link_url as string | undefined
      if (linkType === 'form') {
        // Tasks store the form via link_url = "/forms/<uuid>"
        const m = linkUrl?.match(/\/forms\/([0-9a-fA-F-]{36})/)
        if (m) formIds.add(m[1])
      } else if (linkType === 'resource') {
        // Tasks store resources by id either in link_url or link_resource_id
        const candidate = (task.link_resource_id as string | undefined) ?? linkUrl
        if (candidate && /^[0-9a-fA-F-]{36}$/.test(candidate)) resourceIds.add(candidate)
      }
    }
  }
  return { formIds, resourceIds }
}

export async function DELETE(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try {
    membership = await requireOrgRole(coachId, 'admin')
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Forbidden' }, { status: 403 })
  }

  const { template_id, table } = await req.json() as { template_id: string; table: TemplateTable }

  if (!template_id) return Response.json({ error: 'template_id is required' }, { status: 400 })
  if (!VALID_TABLES.includes(table)) {
    return Response.json({ error: `table must be one of: ${VALID_TABLES.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()

  const [unpublishResult] = await Promise.all([
    admin
      .from(table)
      .update({ is_org_template: false, org_id: null })
      .eq('id', template_id)
      .eq('org_id', membership.org_id),
    // Clean up all per-coach exclusions for this template
    admin
      .from('org_template_exclusions')
      .delete()
      .eq('org_id', membership.org_id)
      .eq('template_id', template_id)
      .eq('template_table', table),
  ])

  if (unpublishResult.error) return Response.json({ error: unpublishResult.error.message }, { status: 500 })

  return Response.json({ ok: true })
}
