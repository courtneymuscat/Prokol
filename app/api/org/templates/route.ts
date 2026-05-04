import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole, getOrgForUser, getCoachPermissions } from '@/lib/org'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type TemplateTable = 'autoflow_templates' | 'programs' | 'meal_plans' | 'forms' | 'note_templates'

const VALID_TABLES: TemplateTable[] = [
  'autoflow_templates',
  'programs',
  'meal_plans',
  'forms',
  'note_templates',
]

const EMPTY = { autoflows: [], programs: [], meal_plans: [], forms: [], note_templates: [] }

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

  const [autoflows, programs, mealPlans, forms, noteTemplates] = await Promise.all([
    admin.from('autoflow_templates').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('programs').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('meal_plans').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('forms').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
    admin.from('note_templates').select('id, name, created_at, created_by').eq('org_id', membership.org_id).eq('is_org_template', true),
  ])

  function filter<T extends { id: string }>(items: T[] | null, table: string): T[] {
    const excluded = excludedTemplateIds[table]
    if (!excluded?.size) return items ?? []
    return (items ?? []).filter((t) => !excluded.has(t.id))
  }

  return Response.json({
    autoflows: filter(autoflows.data, 'autoflow_templates'),
    programs: filter(programs.data, 'programs'),
    meal_plans: filter(mealPlans.data, 'meal_plans'),
    forms: filter(forms.data, 'forms'),
    note_templates: filter(noteTemplates.data, 'note_templates'),
  })
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

  const { template_id, table } = await req.json() as { template_id: string; table: TemplateTable }

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

  return Response.json({ ok: true })
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
