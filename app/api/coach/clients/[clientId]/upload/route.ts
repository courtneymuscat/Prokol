import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

/** POST — save a coach-uploaded file record for a client */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived', 'pending_invite'])
    .single()
  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { url, name } = await req.json()
  if (!url || !name) return Response.json({ error: 'url and name required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('client_files').insert({
    client_id: clientId,
    coach_id: coachId,
    url,
    name,
    uploaded_by: 'coach',
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
