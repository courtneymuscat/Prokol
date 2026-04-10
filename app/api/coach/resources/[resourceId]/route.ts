import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ resourceId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { resourceId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const supabase = await createClient()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description ?? null
  if (body.type !== undefined) updates.type = body.type
  if (body.url !== undefined) updates.url = body.url ?? null
  if (body.folder_id !== undefined) updates.folder_id = body.folder_id ?? null
  const { data, error } = await supabase
    .from('coach_resources')
    .update(updates)
    .eq('id', resourceId)
    .eq('coach_id', coachId)
    .select('*, coach_resource_folders(id, name, color, icon)')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { resourceId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  await supabase.from('coach_resources').delete().eq('id', resourceId).eq('coach_id', coachId)
  return Response.json({ ok: true })
}
