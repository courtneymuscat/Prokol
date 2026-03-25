import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', coachId)
    .single()

  return Response.json({
    email: user?.email ?? '',
    first_name: profile?.first_name ?? '',
  })
}

export async function PUT(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { first_name } = await req.json()

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ first_name: first_name?.trim() || null })
    .eq('id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
