import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_resources')
    .select('*, coach_resource_folders(id, name, color, icon)')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, description, type, url, folder_id } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_resources')
    .insert({
      coach_id: coachId,
      name: name.trim(),
      description: description ?? null,
      type: type ?? 'link',
      url: url ?? null,
      folder_id: folder_id ?? null,
    })
    .select('*, coach_resource_folders(id, name, color, icon)')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
