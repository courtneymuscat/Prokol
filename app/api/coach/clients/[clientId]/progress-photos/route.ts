import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: rel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived', 'pending_invite'])
    .single()
  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rows, error } = await admin
    .from('progress_photos')
    .select('id, storage_path, taken_at, category, notes, weight_kg')
    .eq('user_id', clientId)
    .order('taken_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return Response.json([])

  const photos = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage
        .from('progress-photos')
        .createSignedUrl(row.storage_path, 3600)
      return { ...row, url: signed?.signedUrl ?? null }
    })
  )

  return Response.json(photos.filter((p) => p.url))
}
