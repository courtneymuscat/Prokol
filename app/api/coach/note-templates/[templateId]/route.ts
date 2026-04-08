import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ templateId: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { templateId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, body } = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('note_templates')
    .update({ name: name?.trim(), body: body?.trim() })
    .eq('id', templateId)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { templateId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  await supabase.from('note_templates').delete().eq('id', templateId).eq('coach_id', coachId)
  return Response.json({ ok: true })
}
