import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { recomputeQuotaAssignment } from '@/lib/booking-quota'
import { NextResponse } from 'next/server'

const STATUSES = new Set(['confirmed', 'cancelled', 'completed', 'no_show', 'late_cancel'])
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

  // If status changed (typically to/from cancelled), or payment_status was
  // moved off a coach override, re-walk the quota assignment so a freed
  // slot is handed to the next pending booking.
  if (data?.service_id && (body.status !== undefined || body.payment_status !== undefined)) {
    await recomputeQuotaAssignment(supabase, {
      coachId,
      clientId: data.client_id,
      serviceId: data.service_id,
    })
    const { data: fresh } = await supabase.from('bookings').select('*').eq('id', id).single()
    if (fresh) return NextResponse.json({ booking: fresh })
  }

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
  // Capture the affected (coach,client,service) tuples up front so we can
  // recompute quota after the row is gone.
  const { data: affectedRows } = await supabase
    .from('bookings')
    .select('id, client_id, service_id, series_id, start_at')
    .eq('coach_id', coachId)
    .eq(scope === 'this' ? 'id' : 'id', id)
  const anchor = affectedRows?.[0]

  if (scope === 'this' || !anchor?.series_id) {
    const { error } = await supabase.from('bookings').delete().eq('id', id).eq('coach_id', coachId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (anchor?.client_id && anchor?.service_id) {
      await recomputeQuotaAssignment(supabase, {
        coachId,
        clientId: anchor.client_id,
        serviceId: anchor.service_id,
      })
    }
    return NextResponse.json({ ok: true })
  }

  // Series scope: gather affected client/service pairs before deleting so
  // we can recompute each one.
  let pairsQuery = supabase
    .from('bookings')
    .select('client_id, service_id')
    .eq('coach_id', coachId)
    .eq('series_id', anchor.series_id)
  if (scope === 'future') pairsQuery = pairsQuery.gte('start_at', anchor.start_at)
  const { data: pairs } = await pairsQuery

  let q = supabase.from('bookings').delete().eq('coach_id', coachId).eq('series_id', anchor.series_id)
  if (scope === 'future') q = q.gte('start_at', anchor.start_at)
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const seen = new Set<string>()
  for (const p of pairs ?? []) {
    if (!p.client_id || !p.service_id) continue
    const k = `${p.client_id}:${p.service_id}`
    if (seen.has(k)) continue
    seen.add(k)
    await recomputeQuotaAssignment(supabase, {
      coachId,
      clientId: p.client_id,
      serviceId: p.service_id,
    })
  }

  return NextResponse.json({ ok: true })
}
