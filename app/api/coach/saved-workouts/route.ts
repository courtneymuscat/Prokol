import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { getOrgForUser } from '@/lib/org'
import type { NextRequest } from 'next/server'

// GET — list saved workouts visible to the coach. Includes the coach's own
// saved workouts plus org-template saved workouts published by anyone in
// their org.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const admin = createAdminClient()

  const [ownRes, membership] = await Promise.all([
    supabase
      .from('coach_saved_workouts')
      .select('id, name, description, content, is_org_template, org_id, created_at, updated_at')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false }),
    getOrgForUser(coachId),
  ])

  let orgTemplates: unknown[] = []
  if (membership) {
    const [{ data }, { data: exclusions }] = await Promise.all([
      admin
        .from('coach_saved_workouts')
        .select('id, name, description, content, is_org_template, org_id, coach_id, created_at, updated_at')
        .eq('is_org_template', true)
        .eq('org_id', membership.org_id)
        .neq('coach_id', coachId)
        .order('created_at', { ascending: false }),
      admin
        .from('org_template_exclusions')
        .select('template_id')
        .eq('org_id', membership.org_id)
        .eq('template_table', 'coach_saved_workouts')
        .eq('coach_id', coachId),
    ])
    const excluded = new Set((exclusions ?? []).map((e) => e.template_id as string))
    orgTemplates = (data ?? []).filter((w) => !excluded.has((w as { id: string }).id))
  }

  return Response.json({
    own: ownRes.data ?? [],
    org_templates: orgTemplates,
    org_id: membership?.org_id ?? null,
  })
}

// POST — create a new saved workout. Body: { name, description?, content }
export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description : null
  const content = body.content && typeof body.content === 'object' ? body.content : null

  if (!name) return Response.json({ error: 'Name is required' }, { status: 400 })
  if (!content) return Response.json({ error: 'Content is required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_saved_workouts')
    .insert({ coach_id: coachId, created_by: coachId, name, description, content })
    .select('id, name, description, content, is_org_template, org_id, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
