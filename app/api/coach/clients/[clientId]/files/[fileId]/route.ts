import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string; fileId: string }> }

async function verifyCoach(clientId: string) {
  const coachId = await requireCoach()
  if (!coachId) return null
  const supabase = await createClient()
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived', 'pending_invite'])
    .single()
  return rel ? coachId : null
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { clientId, fileId } = await params
  const coachId = await verifyCoach(clientId)
  if (!coachId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { name } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_files')
    .update({ name: name.trim() })
    .eq('id', fileId)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { clientId, fileId } = await params
  const coachId = await verifyCoach(clientId)
  if (!coachId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Fetch the file to get storage path before deleting the record
  const { data: file } = await admin
    .from('client_files')
    .select('url')
    .eq('id', fileId)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .single()

  const { error } = await admin
    .from('client_files')
    .delete()
    .eq('id', fileId)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)

  if (error) return Response.json({ error: error.message }, { status: 400 })

  // Best-effort storage deletion — extract path from public URL
  if (file?.url) {
    const match = file.url.match(/\/client-uploads\/(.+)$/)
    if (match) {
      await admin.storage.from('client-uploads').remove([match[1]])
    }
  }

  return new Response(null, { status: 204 })
}
