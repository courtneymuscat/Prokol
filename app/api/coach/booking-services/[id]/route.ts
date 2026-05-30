import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { NextResponse } from 'next/server'

const BILLING_MODES = new Set(['subscription', 'separate'])

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    updates.name = name
  }
  if (body.description !== undefined) updates.description = body.description?.trim() || null
  if (body.duration_minutes !== undefined) {
    updates.duration_minutes = Math.max(5, Math.min(480, Number(body.duration_minutes) || 60))
  }
  if (body.billing_mode !== undefined) {
    if (!BILLING_MODES.has(body.billing_mode)) {
      return NextResponse.json({ error: 'Invalid billing_mode' }, { status: 400 })
    }
    updates.billing_mode = body.billing_mode
  }
  if (body.payment_link !== undefined) updates.payment_link = body.payment_link?.trim() || null
  if (body.quota_per_month !== undefined) {
    updates.quota_per_month =
      body.quota_per_month === null || body.quota_per_month === ''
        ? null
        : Math.max(0, Math.floor(Number(body.quota_per_month) || 0))
  }
  if (body.color !== undefined) updates.color = body.color?.trim() || '#1D9E75'
  if (body.active !== undefined) updates.active = !!body.active

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_services')
    .update(updates)
    .eq('id', id)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ service: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase
    .from('booking_services')
    .delete()
    .eq('id', id)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
