import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole, getOrgForUser } from '@/lib/org'
import type { NextRequest } from 'next/server'

type TemplateTable = 'autoflow_templates' | 'programs' | 'meal_plans' | 'forms' | 'note_templates'

const VALID_TABLES: TemplateTable[] = [
  'autoflow_templates',
  'programs',
  'meal_plans',
  'forms',
  'note_templates',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Any org member can view org templates
  const membership = await getOrgForUser(session.user.id)
  if (!membership) return Response.json({ error: 'Not a member of any organisation' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch org templates from all 5 tables in parallel
  const [autoflows, programs, mealPlans, forms, noteTemplates] = await Promise.all([
    admin
      .from('autoflow_templates')
      .select('id, name, created_at, created_by')
      .eq('org_id', membership.org_id)
      .eq('is_org_template', true),

    admin
      .from('programs')
      .select('id, name, created_at, created_by')
      .eq('org_id', membership.org_id)
      .eq('is_org_template', true),

    admin
      .from('meal_plans')
      .select('id, name, created_at, created_by')
      .eq('org_id', membership.org_id)
      .eq('is_org_template', true),

    admin
      .from('forms')
      .select('id, name, created_at, created_by')
      .eq('org_id', membership.org_id)
      .eq('is_org_template', true),

    admin
      .from('note_templates')
      .select('id, name, created_at, created_by')
      .eq('org_id', membership.org_id)
      .eq('is_org_template', true),
  ])

  return Response.json({
    autoflows: autoflows.data ?? [],
    programs: programs.data ?? [],
    meal_plans: mealPlans.data ?? [],
    forms: forms.data ?? [],
    note_templates: noteTemplates.data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Publishing an org template requires owner or admin
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
