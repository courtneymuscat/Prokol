import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { NextResponse } from 'next/server'

const STATUSES = new Set(['confirmed', 'cancelled', 'completed', 'no_show'])
const PAYMENT_STATUSES = new Set(['pending', 'paid', 'included', 'waived', 'refunded'])

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.start_at !== undefined) {
    const d = new Date(body.start_at)
    if (Number.isNaN(d.valueOf())) return NextResponse.json({ error: 'Invalid start_at' }, { status: 400 })
    updates.start_at = d.toISOString()
  }
  if (body.duration_minutes !== undefined) {
    updates.duration_minutes = Math.max(5, Math.min(480, Number(body.duration_minutes) || 60))
  }
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    updates.status = body.status
    if (body.status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString()
      updates.cancelled_by = body.cancelled_by ?? 'coach'
      if (body.cancellation_reason !== undefined) updates.cancellation_reason = body.cancellation_reason
    }
  }
  if (body.payment_status !== undefined) {
    if (!PAYMENT_STATUSES.has(body.payment_status)) {
      return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
    }
    updates.payment_status = body.payment_status
  }
  if (body.location !== undefined) updates.location = body.location?.trim() || null
  if (body.meeting_url !== undefined) updates.meeting_url = body.meeting_url?.trim() || null
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null
  if (body.coach_notes !== undefined) updates.coach_notes = body.coach_notes?.trim() || null
  if (body.payment_link !== undefined) updates.payment_link = body.payment_link?.trim() || null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('coach_id', coachId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ booking: data })
}

// DELETE /api/coach/bookings/[id]?scope=this|future|series
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') ?? 'this'

  const supabase = await createClient()
  if (scope === 'this') {
    const { error } = await supabase.from('bookings').delete().eq('id', id).eq('coach_id', coachId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // Resolve the series and the anchor row's start time.
  const { data: anchor } = await supabase
    .from('bookings')
    .select('series_id, start_at')
    .eq('id', id)
    .eq('coach_id', coachId)
    .single()
  if (!anchor?.series_id) {
    // Not part of a series — just delete the row.
    const { error } = await supabase.from('bookings').delete().eq('id', id).eq('coach_id', coachId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  let q = supabase.from('bookings').delete().eq('coach_id', coachId).eq('series_id', anchor.series_id)
  if (scope === 'future') q = q.gte('start_at', anchor.start_at)
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
