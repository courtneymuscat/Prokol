import { NextRequest, NextResponse } from 'next/server'
import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('client_tags')
    .select('id, name, color, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { name?: string; color?: string }
  const name = body.name?.trim()
  const color = body.color?.trim()
  if (!name || !color) return NextResponse.json({ error: 'name and color required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_tags')
    .insert({ coach_id: coachId, name, color })
    .select('id, name, color, created_at')
    .single()

  if (error || !data) {
    const status = error?.code === '23505' ? 409 : 500
    return NextResponse.json({ error: error?.code === '23505' ? 'You already have a tag with that name' : (error?.message ?? 'Failed to create tag') }, { status })
  }
  return NextResponse.json(data)
}
