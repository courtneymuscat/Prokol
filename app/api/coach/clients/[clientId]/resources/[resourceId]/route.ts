import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; resourceId: string }> }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { clientId, resourceId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  await supabase
    .from('client_resource_access')
    .delete()
    .eq('resource_id', resourceId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
  return Response.json({ ok: true })
}
