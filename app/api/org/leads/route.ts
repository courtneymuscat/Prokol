import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgRole } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ leads: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let membership
  try { membership = await requireOrgRole(session.user.id, 'coach') }
  catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const body = await req.json()
  const { name, email, phone, source, status, notes, follow_up_done, follow_up_date } = body
  if (!name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .insert({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      source: source || 'other',
      status: status || 'new',
      notes: notes?.trim() || null,
      follow_up_done: follow_up_done ?? false,
      follow_up_date: follow_up_date || null,
      created_by: session.user.id,
      org_id: membership.org_id,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ lead: data })
}
