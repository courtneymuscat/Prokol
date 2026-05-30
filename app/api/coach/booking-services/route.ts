import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { NextResponse } from 'next/server'

const BILLING_MODES = new Set(['subscription', 'separate'])

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_services')
    .select('*')
    .eq('coach_id', coachId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ services: data ?? [] })
}

export async function POST(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body?.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const billing_mode = BILLING_MODES.has(body?.billing_mode) ? body.billing_mode : 'separate'
  const duration_minutes = Math.max(5, Math.min(480, Number(body?.duration_minutes) || 60))
  const quota_per_month =
    body?.quota_per_month === null || body?.quota_per_month === undefined || body?.quota_per_month === ''
      ? null
      : Math.max(0, Math.floor(Number(body.quota_per_month) || 0))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_services')
    .insert({
      coach_id: coachId,
      name,
      description: body?.description?.trim() || null,
      duration_minutes,
      billing_mode,
      payment_link: body?.payment_link?.trim() || null,
      quota_per_month,
      color: body?.color?.trim() || '#1D9E75',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ service: data })
}
