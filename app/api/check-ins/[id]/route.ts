import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()

  // Admin client bypasses RLS to read the client's check-in
  const { data: checkIn } = await admin
    .from('check_ins')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!checkIn) return Response.json({ error: 'Not found' }, { status: 404 })

  // Verify the check-in belongs to one of this coach's clients
  const supabase = await createClient()
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', checkIn.user_id)
    .in('status', ['active', 'archived'])
    .single()

  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin.from('check_ins').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
