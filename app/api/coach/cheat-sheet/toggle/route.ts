import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { resolveOrgSharedUserId } from '@/lib/org'
import { NextResponse } from 'next/server'

// PATCH /api/coach/cheat-sheet/toggle — toggle a default food's visibility
export async function PATCH(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isMember } = await resolveOrgSharedUserId(coachId)
  if (isMember) {
    return NextResponse.json(
      { error: 'Cheat sheet is managed by your organisation' },
      { status: 403 },
    )
  }

  const { food_id, is_hidden } = await req.json()
  const supabase = await createClient()

  const { error } = await supabase
    .from('coach_cheat_sheet')
    .upsert({ coach_id: coachId, food_id, is_hidden }, { onConflict: 'coach_id,food_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
