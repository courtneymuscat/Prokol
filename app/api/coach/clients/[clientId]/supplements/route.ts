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
  const { data, error } = await supabase
    .from('client_supplements')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { supplement_id, name, dosage, benefits, brand_url, notes, considerations } = body
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_supplements')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      supplement_id: supplement_id ?? null,
      name: name.trim(),
      dosage: dosage ?? null,
      benefits: benefits ?? null,
      considerations: considerations ?? null,
      brand_url: brand_url ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
