import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/coach'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ clientId: string }> }

async function verifyClientOwnership(coachId: string, clientId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .maybeSingle()
  return !!data
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId } = await params

  const body = await req.json() as { tagId?: string }
  if (!body.tagId) return NextResponse.json({ error: 'tagId required' }, { status: 400 })

  if (!(await verifyClientOwnership(coachId, clientId))) {
    return NextResponse.json({ error: 'Not your client' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: tag } = await admin
    .from('client_tags')
    .select('id')
    .eq('id', body.tagId)
    .eq('coach_id', coachId)
    .maybeSingle()
  if (!tag) return NextResponse.json({ error: 'Tag not found' }, { status: 404 })

  const { error } = await admin
    .from('client_tag_assignments')
    .upsert({ tag_id: body.tagId, client_id: clientId, coach_id: coachId }, { onConflict: 'tag_id,client_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId } = await params

  const body = await req.json() as { tagId?: string }
  if (!body.tagId) return NextResponse.json({ error: 'tagId required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('client_tag_assignments')
    .delete()
    .eq('tag_id', body.tagId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
