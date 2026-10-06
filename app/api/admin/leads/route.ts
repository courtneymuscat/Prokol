import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/admin'
import type { NextRequest } from 'next/server'

// Court's own platform-growth CRM (gym-partnership prospects etc.) — org_id
// IS NULL is what distinguishes these from any organisation's own client
// leads (see supabase/migrations/20260418000002_leads_org_id.sql). Every
// query here must stay scoped to org_id IS NULL so this never shows (or
// lets Court edit/delete) another org's leads.

export async function GET() {
  await requirePlatformAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('leads')
    .select('*')
    .is('org_id', null)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ leads: data ?? [] })
}

export async function POST(req: NextRequest) {
  await requirePlatformAdmin()
  const supabase = await createClient()
  const body = await req.json()

  const { name, email, phone, source, status, notes, follow_up_done, follow_up_date } = body
  if (!name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 })

  const { data: { session } } = await supabase.auth.getSession()

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
      created_by: session?.user.id ?? null,
      org_id: null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ lead: data })
}
