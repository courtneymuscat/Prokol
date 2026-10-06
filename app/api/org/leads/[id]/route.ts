import { createClient } from '@/lib/supabase/server'
import { requireOrgRole, updateOrgLead, deleteOrgLead } from '@/lib/org'
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

  const result = await updateOrgLead(membership.org_id, id, body)
  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ lead: result.lead })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const { id } = await params
  const result = await deleteOrgLead(membership.org_id, id)
  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ ok: true })
}
