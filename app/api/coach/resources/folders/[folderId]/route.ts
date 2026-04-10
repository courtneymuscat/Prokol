import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ folderId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { folderId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const supabase = await createClient()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.color !== undefined) updates.color = body.color
  if (body.icon !== undefined) updates.icon = body.icon
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order
  const { data, error } = await supabase
    .from('coach_resource_folders')
    .update(updates)
    .eq('id', folderId)
    .eq('coach_id', coachId)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { folderId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  await supabase.from('coach_resource_folders').delete().eq('id', folderId).eq('coach_id', coachId)
  return Response.json({ ok: true })
}
