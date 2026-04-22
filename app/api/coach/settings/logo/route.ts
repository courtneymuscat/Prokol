import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_SIZE) return Response.json({ error: 'Logo must be under 2 MB' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `coach-logos/${coachId}/logo.${ext}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('org-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = admin.storage.from('org-assets').getPublicUrl(path)
  return Response.json({ url: urlData.publicUrl })
}
