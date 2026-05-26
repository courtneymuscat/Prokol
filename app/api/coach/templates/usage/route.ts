import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

// GET /api/coach/templates/usage?table=programs&id=<uuid>
//
// Returns who currently has a template assigned (and who has previously
// completed it) so the delete-confirmation dialog can tell the coach
// what would break if they hard-deleted, and reassure them that
// archiving leaves all of this intact.
//
// One endpoint, four supported template types — kept generic so the
// shared DeleteTemplateDialog component doesn't have to branch per
// table on the client side.

type TemplateTable = 'programs' | 'meal_plans' | 'autoflow_templates' | 'forms'

type UsageClient = {
  id: string
  name: string | null
  email: string | null
  status: 'active' | 'completed' | 'paused' | 'inactive' | 'archived' | 'scheduled'
  started_at: string | null
}

type UsageResponse = {
  active: number
  completed: number
  scheduled: number
  total: number
  clients: UsageClient[]
  // True if the template is currently published to the coach's org —
  // archiving / deleting it ripples to other coaches in that case.
  is_org_template: boolean
}

const VALID: TemplateTable[] = ['programs', 'meal_plans', 'autoflow_templates', 'forms']

export async function GET(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const url = new URL(req.url)
  const table = url.searchParams.get('table') as TemplateTable | null
  const id = url.searchParams.get('id')
  if (!table || !VALID.includes(table) || !id) {
    return Response.json({ error: 'table + id required' }, { status: 400 })
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  // Confirm the coach owns the template (or it's an org template they
  // can see) — otherwise zero out everything.
  const { data: template } = await supabase
    .from(table)
    .select('id, coach_id, is_org_template')
    .eq('id', id)
    .maybeSingle()
  if (!template) {
    const empty: UsageResponse = { active: 0, completed: 0, scheduled: 0, total: 0, clients: [], is_org_template: false }
    return Response.json(empty)
  }

  const isOrgTemplate = !!(template as { is_org_template?: boolean }).is_org_template

  // Each table has a different "client linkage" table + status column
  // shape, so we branch internally and return a normalised response.
  let clients: UsageClient[] = []

  if (table === 'programs') {
    const { data } = await admin
      .from('client_programs')
      .select('id, status, start_date, client_id')
      .eq('program_id', id)
      .order('start_date', { ascending: false })
    clients = await attachProfiles(admin, (data ?? []).map((r) => ({
      id: r.client_id as string,
      status: normaliseStatus(r.status as string),
      started_at: r.start_date as string | null,
    })))
  }

  if (table === 'meal_plans') {
    const { data } = await admin
      .from('client_meal_plans')
      .select('id, status, start_date, client_id')
      .eq('meal_plan_id', id)
      .order('start_date', { ascending: false })
    clients = await attachProfiles(admin, (data ?? []).map((r) => ({
      id: r.client_id as string,
      status: normaliseStatus(r.status as string),
      started_at: r.start_date as string | null,
    })))
  }

  if (table === 'autoflow_templates') {
    const { data } = await admin
      .from('client_autoflows')
      .select('id, status, start_date, client_id')
      .eq('template_id', id)
      .order('start_date', { ascending: false })
    clients = await attachProfiles(admin, (data ?? []).map((r) => ({
      id: r.client_id as string,
      status: normaliseStatus(r.status as string),
      started_at: r.start_date as string | null,
    })))
  }

  if (table === 'forms') {
    // Forms have two usage paths: a checkin_schedules row pointing at
    // the form (scheduled / recurring) and form_submissions (history).
    // Merge by client_id so a client who's been both scheduled and has
    // submitted shows up once with the most-active status.
    const [{ data: schedules }, { data: submissions }] = await Promise.all([
      admin
        .from('checkin_schedules')
        .select('client_id, created_at')
        .eq('form_id', id),
      admin
        .from('form_submissions')
        .select('client_id, submitted_at')
        .eq('form_id', id)
        .order('submitted_at', { ascending: false }),
    ])
    const byClient = new Map<string, UsageClient>()
    for (const s of submissions ?? []) {
      const cid = s.client_id as string
      if (!cid) continue
      if (!byClient.has(cid)) {
        byClient.set(cid, {
          id: cid,
          name: null,
          email: null,
          status: 'completed',
          started_at: s.submitted_at as string | null,
        })
      }
    }
    for (const s of schedules ?? []) {
      const cid = s.client_id as string
      if (!cid) continue
      const existing = byClient.get(cid)
      if (existing) {
        // Scheduled status wins over completed in the summary because
        // it indicates an ongoing relationship with the form.
        existing.status = 'scheduled'
      } else {
        byClient.set(cid, {
          id: cid,
          name: null,
          email: null,
          status: 'scheduled',
          started_at: s.created_at as string | null,
        })
      }
    }
    clients = await attachProfiles(admin, Array.from(byClient.values()).map((c) => ({
      id: c.id,
      status: c.status,
      started_at: c.started_at,
    })))
  }

  const active    = clients.filter((c) => c.status === 'active' || c.status === 'paused').length
  const scheduled = clients.filter((c) => c.status === 'scheduled').length
  const completed = clients.filter((c) => c.status === 'completed').length

  const response: UsageResponse = {
    active,
    scheduled,
    completed,
    total: clients.length,
    clients: clients.slice(0, 25), // cap response size
    is_org_template: isOrgTemplate,
  }
  return Response.json(response)
}

function normaliseStatus(raw: string | null): UsageClient['status'] {
  if (raw === 'active') return 'active'
  if (raw === 'completed') return 'completed'
  if (raw === 'paused') return 'paused'
  if (raw === 'archived') return 'archived'
  if (raw === 'inactive') return 'inactive'
  // client_meal_plans uses 'active'/'inactive', client_autoflows uses
  // 'active'/'completed'/'paused'. Anything else collapses to inactive.
  return 'inactive'
}

async function attachProfiles(
  admin: ReturnType<typeof createAdminClient>,
  rows: Array<{ id: string; status: UsageClient['status']; started_at: string | null }>,
): Promise<UsageClient[]> {
  if (rows.length === 0) return []
  const ids = Array.from(new Set(rows.map((r) => r.id)))
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, first_name, email')
    .in('id', ids)
  const map = new Map<string, { name: string | null; email: string | null }>(
    (data ?? []).map((p) => [
      p.id as string,
      {
        name: ((p as { full_name?: string | null }).full_name ?? (p as { first_name?: string | null }).first_name) ?? null,
        email: (p as { email?: string | null }).email ?? null,
      },
    ]),
  )
  return rows.map((r) => ({
    id: r.id,
    name: map.get(r.id)?.name ?? null,
    email: map.get(r.id)?.email ?? null,
    status: r.status,
    started_at: r.started_at,
  }))
}
