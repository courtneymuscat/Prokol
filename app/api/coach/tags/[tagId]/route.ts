import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ tagId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tagId } = await params

  const body = await req.json() as { name?: string; color?: string }
  const patch: Record<string, string> = {}
  if (body.name?.trim()) patch.name = body.name.trim()
  if (body.color?.trim()) patch.color = body.color.trim()
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('client_tags')
    .update(patch)
    .eq('id', tagId)
    .eq('coach_id', coachId)

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: error.code === '23505' ? 'You already have a tag with that name' : error.message }, { status })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tagId } = await params

  const admin = createAdminClient()
  const { error } = await admin
    .from('client_tags')
    .delete()
    .eq('id', tagId)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
