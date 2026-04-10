import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ clientId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  const { data } = await supabase
    .from('client_resource_access')
    .select('id, assigned_at, coach_resources(id, name, description, type, url, coach_resource_folders(id, name, color, icon))')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .order('assigned_at', { ascending: false })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { resource_id } = await req.json()
  if (!resource_id) return Response.json({ error: 'resource_id required' }, { status: 400 })
  const supabase = await createClient()

  // Verify the resource belongs to this coach
  const { data: resource } = await supabase
    .from('coach_resources')
    .select('id')
    .eq('id', resource_id)
    .eq('coach_id', coachId)
    .single()
  if (!resource) return Response.json({ error: 'Resource not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('client_resource_access')
    .upsert({ resource_id, client_id: clientId, coach_id: coachId }, { onConflict: 'resource_id,client_id' })
    .select('id, assigned_at, coach_resources(id, name, description, type, url, coach_resource_folders(id, name, color, icon))')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
