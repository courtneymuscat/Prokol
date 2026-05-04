import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { video_url } = await req.json()
  const url = video_url?.trim() || null

  const supabase = await createClient()
  const admin = createAdminClient()

  // Check if this is a custom exercise owned by this coach
  const { data: ex } = await admin
    .from('exercises')
    .select('is_custom, created_by')
    .eq('id', id)
    .single()

  if (ex?.is_custom && ex?.created_by === coachId) {
    // Coach owns this exercise — update it directly via admin to bypass RLS
    const { error } = await admin
      .from('exercises')
      .update({ video_url: url })
      .eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  } else {
    // Global exercise — save to per-coach override so it doesn't affect other coaches
    const { error } = await supabase
      .from('coach_exercise_videos')
      .upsert(
        { coach_id: coachId, exercise_id: id, video_url: url, updated_at: new Date().toISOString() },
        { onConflict: 'coach_id,exercise_id' }
      )
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
