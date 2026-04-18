import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const { id } = await params
  const body = await req.json()
  const allowed = ['name', 'email', 'phone', 'source', 'status', 'notes', 'follow_up_done', 'follow_up_date']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .update(update)
    .eq('id', id)
    .eq('org_id', membership.org_id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ lead: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('leads').delete().eq('id', id).eq('org_id', membership.org_id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
