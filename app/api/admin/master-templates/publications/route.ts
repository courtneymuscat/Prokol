import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canPublishMasterTemplate, type MasterLibraryTable } from '@/lib/org'
import { isGymPartnershipsEnabled } from '@/lib/flags'

const VALID_TABLES: MasterLibraryTable[] = ['autoflow_templates', 'programs', 'meal_plans', 'forms', 'note_templates']

// POST /api/admin/master-templates/publications
// Body: { template_id: string, template_table: MasterLibraryTable, org_id: string }
//
// Publishes one of Court's master templates into a gym (or any) org's
// library. Only Court's platform-admin account, publishing a template that
// belongs to her own organisation, can do this — see
// lib/org.ts canPublishMasterTemplate() for the full rule. No org, gym or
// otherwise, can publish its own templates into another org.
export async function POST(req: NextRequest) {
  if (!isGymPartnershipsEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    template_id?: string
    template_table?: string
    org_id?: string
  }
  const { template_id, template_table, org_id } = body
  if (!template_id || !template_table || !org_id) {
    return NextResponse.json({ error: 'template_id, template_table and org_id are required' }, { status: 400 })
  }
  if (!VALID_TABLES.includes(template_table as MasterLibraryTable)) {
    return NextResponse.json({ error: 'Invalid template_table' }, { status: 400 })
  }

  const allowed = await canPublishMasterTemplate(session.user.id, template_id, template_table as MasterLibraryTable)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('master_template_publications')
    .insert({
      template_id,
      template_table,
      org_id,
      published_by: session.user.id,
    })
    .select('id, template_id, template_table, org_id, published_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// GET /api/admin/master-templates/publications?org_id=...
// Lists every master template published to the given gym/org. Platform-admin
// only for now (Phase 1 has no gym-facing UI yet).
export async function GET(req: NextRequest) {
  if (!isGymPartnershipsEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()
  if (profile?.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id is required' }, { status: 400 })

  const { data, error } = await admin
    .from('master_template_publications')
    .select('id, template_id, template_table, org_id, published_by, published_at')
    .eq('org_id', orgId)
    .order('published_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
