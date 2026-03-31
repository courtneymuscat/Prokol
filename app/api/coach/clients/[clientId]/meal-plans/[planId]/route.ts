import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; planId: string }> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_meal_plans')
    .select('*')
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; planId: string }> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()
  const { name, content, status } = body

  const { data, error } = await supabase
    .from('client_meal_plans')
    .update({ name, content, status, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error || !data) return Response.json({ error: error?.message ?? 'Not found' }, { status: 400 })
  return Response.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; planId: string }> }
) {
  const { clientId, planId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('client_meal_plans')
    .delete()
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
