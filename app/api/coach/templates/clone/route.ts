import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { getOrgForUser, getCoachPermissions } from '@/lib/org'
import type { NextRequest } from 'next/server'

const CLONABLE_TABLES = new Set([
  'autoflow_templates',
  'programs',
  'meal_plans',
  'forms',
  'note_templates',
  'coach_services',
  'coach_resources',
])

type TableName =
  | 'autoflow_templates'
  | 'programs'
  | 'meal_plans'
  | 'forms'
  | 'note_templates'
  | 'coach_services'
  | 'coach_resources'

/**
 * Clone an org-published template into the coach's own list. The copy is
 * fully detached (org_id null, is_org_template false) so subsequent edits
 * never propagate to other coaches.
 *
 * Body: { table: TableName, source_id: string }
 * Response: { id: string }  // the new (own) template id
 */
export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { table, source_id } = (await req.json()) as { table?: string; source_id?: string }
  if (!table || !source_id) return Response.json({ error: 'table and source_id are required' }, { status: 400 })
  if (!CLONABLE_TABLES.has(table)) return Response.json({ error: 'Invalid table' }, { status: 400 })

  const tbl = table as TableName

  const membership = await getOrgForUser(coachId)
  if (!membership) return Response.json({ error: 'Not in an organisation' }, { status: 403 })
  if (membership.role === 'coach') {
    const perms = await getCoachPermissions(coachId, membership.org_id)
    if (!perms.can_use_org_templates) {
      return Response.json({ error: 'Org template access disabled by admin' }, { status: 403 })
    }
  }

  const admin = createAdminClient()
  const { data: source } = await admin
    .from(tbl)
    .select('*')
    .eq('id', source_id)
    .single()

  if (!source) return Response.json({ error: 'Template not found' }, { status: 404 })
  if (!source.is_org_template || source.org_id !== membership.org_id) {
    return Response.json({ error: 'Not an org template in your organisation' }, { status: 403 })
  }

  // Strip identifiers + org markers so the row becomes a fresh own-template
  const sourceRow = source as Record<string, unknown>
  const copy: Record<string, unknown> = { ...sourceRow }
  delete copy.id
  delete copy.created_at
  delete copy.updated_at
  copy.coach_id = coachId
  copy.org_id = null
  copy.is_org_template = false
  copy.created_by = coachId

  // Resources reference the owner's folder by id — drop it so the cloned row
  // lands in the cloning coach's "uncategorised" bucket.
  if (tbl === 'coach_resources') {
    copy.folder_id = null
  }

  const nameField = tbl === 'forms' ? 'title' : 'name'
  const originalName = (sourceRow[nameField] as string | undefined) ?? 'Template'
  copy[nameField] = `${originalName} (copy)`

  const { data: inserted, error } = await admin
    .from(tbl)
    .insert(copy)
    .select('id')
    .single()

  if (error || !inserted) {
    return Response.json({ error: error?.message ?? 'Failed to clone' }, { status: 500 })
  }

  // Clone child rows for tables that have them
  if (tbl === 'autoflow_templates') {
    const { data: steps } = await admin
      .from('autoflow_template_steps')
      .select('*')
      .eq('template_id', source_id)
    if (steps?.length) {
      const stepRows = steps.map((s: Record<string, unknown>) => {
        const copy = { ...s }
        delete copy.id
        delete copy.created_at
        copy.template_id = inserted.id
        return copy
      })
      await admin.from('autoflow_template_steps').insert(stepRows)
    }
  } else if (tbl === 'forms') {
    // Forms use a JSON `fields` / `sections` column (already on the row)
    // so the spread above already cloned the structure. Nothing extra needed.
  }

  return Response.json({ id: inserted.id })
}
