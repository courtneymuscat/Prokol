import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { getOrgForUser } from '@/lib/org'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

// PATCH — rename, edit description, or publish as org template. Only the
// owner can edit (RLS enforces this; we also explicitly check).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string') {
    const n = body.name.trim()
    if (!n) return Response.json({ error: 'Name cannot be empty' }, { status: 400 })
    patch.name = n
  }
  if (body.description === null || typeof body.description === 'string') {
    patch.description = body.description
  }
  if (body.content && typeof body.content === 'object') {
    patch.content = body.content
  }

  // Publishing as org template: must be in an org. We resolve the org from
  // the coach's membership rather than trusting the client.
  if (typeof body.is_org_template === 'boolean') {
    if (body.is_org_template) {
      const membership = await getOrgForUser(coachId)
      if (!membership) {
        return Response.json({ error: 'Not in an organisation' }, { status: 400 })
      }
      patch.is_org_template = true
      patch.org_id = membership.org_id
      // Ensure created_by reflects the publisher so the org dashboard can
      // attribute the row (mirrors the org templates POST flow).
      patch.created_by = coachId
    } else {
      patch.is_org_template = false
      // Keep org_id so we know where it was published before; but it's no
      // longer visible to org members because the RLS clause checks the flag.
    }
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'No changes' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('coach_saved_workouts')
    .update(patch)
    .eq('id', id)
    .eq('coach_id', coachId)
    .select('id, name, description, content, is_org_template, org_id, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// DELETE — only the owner can delete (RLS enforces).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('coach_saved_workouts')
    .delete()
    .eq('id', id)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
