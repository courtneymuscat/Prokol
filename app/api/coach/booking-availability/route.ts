import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { NextResponse } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_availability')
    .select('*')
    .eq('coach_id', coachId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ blocks: data ?? [] })
}

export async function POST(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const day_of_week = Number(body?.day_of_week)
  if (!Number.isInteger(day_of_week) || day_of_week < 0 || day_of_week > 6) {
    return NextResponse.json({ error: 'day_of_week must be 0-6' }, { status: 400 })
  }
  const start_time = String(body?.start_time ?? '').trim()
  const end_time = String(body?.end_time ?? '').trim()
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(start_time) || !/^\d{2}:\d{2}(:\d{2})?$/.test(end_time)) {
    return NextResponse.json({ error: 'start_time and end_time must be HH:MM' }, { status: 400 })
  }
  if (start_time >= end_time) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_availability')
    .insert({
      coach_id: coachId,
      day_of_week,
      start_time,
      end_time,
      label: body?.label?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ block: data })
}
