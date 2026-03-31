import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('habits')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { name, type, target, unit, icon } = body

  const { data, error } = await supabase
    .from('habits')
    .insert({ name, type, target, unit, icon, coach_id: coachId, client_id: clientId })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
