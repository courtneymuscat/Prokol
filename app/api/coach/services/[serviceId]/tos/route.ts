import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ serviceId: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { serviceId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const maxBytes = 10 * 1024 * 1024 // 10 MB
  if (file.size > maxBytes) return Response.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  if (!allowed.includes(file.type)) return Response.json({ error: 'Only PDF and Word documents are accepted' }, { status: 400 })

  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.includes('openxml') ? 'docx' : 'doc'
  const path = `service-tos/${coachId}/${serviceId}/tos.${ext}`

  const admin = createAdminClient()

  // Verify coach owns this service
  const supabase = await createClient()
  const { data: service } = await supabase
    .from('coach_services')
    .select('id')
    .eq('id', serviceId)
    .eq('coach_id', coachId)
    .single()
  if (!service) return Response.json({ error: 'Service not found' }, { status: 404 })

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('org-assets')
    .upload(path, bytes, { upsert: true, contentType: file.type })
  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = admin.storage.from('org-assets').getPublicUrl(path)
  const tos_url = urlData.publicUrl

  const { error: dbError } = await supabase
    .from('coach_services')
    .update({ tos_url })
    .eq('id', serviceId)
    .eq('coach_id', coachId)
  if (dbError) return Response.json({ error: dbError.message }, { status: 500 })

  return Response.json({ tos_url })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { serviceId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('coach_services')
    .update({ tos_url: null })
    .eq('id', serviceId)
    .eq('coach_id', coachId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
