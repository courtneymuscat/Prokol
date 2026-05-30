import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase
    .from('coach_availability')
    .delete()
    .eq('id', id)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
