import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone, full_name, date_of_birth, phone, sex, subscription_tier')
    .eq('id', session.user.id)
    .single()

  return Response.json({
    timezone: profile?.timezone ?? null,
    full_name: (profile as Record<string, unknown>)?.full_name ?? null,
    date_of_birth: (profile as Record<string, unknown>)?.date_of_birth ?? null,
    phone: (profile as Record<string, unknown>)?.phone ?? null,
    sex: profile?.sex ?? null,
    subscription_tier: profile?.subscription_tier ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()

  // Allow patching timezone OR profile details (full_name, date_of_birth, phone)
  const allowed = ['timezone', 'full_name', 'date_of_birth', 'phone']
  const update: Record<string, string> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  if (Object.keys(update).length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', session.user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
