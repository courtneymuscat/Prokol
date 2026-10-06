import { createClient } from '@/lib/supabase/server'
import { requireOrgRole, listOrgLeads, createOrgLead } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const leads = await listOrgLeads(membership.org_id)
  return Response.json({ leads })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const body = await req.json()
  if (!body?.name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 })

  const result = await createOrgLead(membership.org_id, session.user.id, body)
  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ lead: result.lead })
}
