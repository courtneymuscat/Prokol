import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  const { data } = await supabase
    .from('coach_resource_folders')
    .select('*')
    .eq('coach_id', coachId)
    .order('sort_order')
    .order('created_at')
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, color, icon } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_resource_folders')
    .insert({ coach_id: coachId, name: name.trim(), color: color ?? 'blue', icon: icon ?? '📁' })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
