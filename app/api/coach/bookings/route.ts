import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { recomputeQuotaAssignment } from '@/lib/booking-quota'
import { NextResponse } from 'next/server'

type ServiceRow = {
  id: string
  name: string
  color: string | null
  duration_minutes: number
  billing_mode: 'subscription' | 'separate'
  payment_link: string | null
  quota_total: number | null
}

// GET /api/coach/bookings?from=ISO&to=ISO&client_id=&status=&payment_status=
export async function GET(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')
  const paymentStatus = searchParams.get('payment_status')

  const supabase = await createClient()
  let q = supabase
    .from('bookings')
    .select('*')
    .eq('coach_id', coachId)
    .order('start_at', { ascending: true })
  if (from) q = q.gte('start_at', from)
  if (to) q = q.lte('start_at', to)
  if (clientId) q = q.eq('client_id', clientId)
  if (status) q = q.eq('status', status)
  if (paymentStatus) q = q.eq('payment_status', paymentStatus)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ bookings: data ?? [] })
}

// POST /api/coach/bookings — create one booking or a recurring series.
// Body: {
//   client_id, service_id, start_at (ISO UTC), duration_minutes?,
//   coach_tz?, client_tz?, location?, meeting_url?, notes?, coach_notes?,
//   payment_link?, recurrence?: { freq: 'weekly', count: number }
// }
export async function POST(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const clientId = String(body?.client_id ?? '')
  const serviceId = String(body?.service_id ?? '')
  const startAt = String(body?.start_at ?? '')
  if (!clientId || !serviceId || !startAt) {
    return NextResponse.json({ error: 'client_id, service_id, and start_at are required' }, { status: 400 })
  }
  const startDate = new Date(startAt)
  if (Number.isNaN(startDate.valueOf())) {
    return NextResponse.json({ error: 'Invalid start_at' }, { status: 400 })
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  // Verify the client is one of the coach's clients
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()
  if (!rel) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Load the service and snapshot its values onto each booking row
  const { data: service } = await supabase
    .from('booking_services')
    .select('*')
    .eq('id', serviceId)
    .eq('coach_id', coachId)
    .single<ServiceRow>()
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  // Snapshot timezones — fall back to profile values if not supplied
  let coachTz = body?.coach_tz?.trim() || ''
  let clientTz = body?.client_tz?.trim() || ''
  if (!coachTz || !clientTz) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, timezone')
      .in('id', [coachId, clientId])
    const coachProfile = profiles?.find((p) => p.id === coachId)
    const clientProfile = profiles?.find((p) => p.id === clientId)
    coachTz = coachTz || coachProfile?.timezone || 'UTC'
    clientTz = clientTz || clientProfile?.timezone || coachTz
  }

  const durationMinutes = Math.max(5, Math.min(480, Number(body?.duration_minutes) || service.duration_minutes))

  // Build occurrence list. Supported frequencies: weekly, biweekly, monthly.
  // Monthly advances by one calendar month per occurrence; if the source
  // date is the 31st and the next month is shorter, JS rolls forward
  // (e.g. Jan 31 → Mar 3) — acceptable for v1; coach can edit per row.
  const recurrence = body?.recurrence
  const occurrences: Date[] = [startDate]
  let recurrenceRule: string | null = null
  if (recurrence && typeof recurrence.freq === 'string') {
    const count = Math.max(1, Math.min(52, Math.floor(Number(recurrence.count) || 1)))
    if (count > 1) {
      if (recurrence.freq === 'weekly') {
        recurrenceRule = `FREQ=WEEKLY;COUNT=${count}`
        for (let i = 1; i < count; i++) {
          const d = new Date(startDate)
          d.setUTCDate(d.getUTCDate() + 7 * i)
          occurrences.push(d)
        }
      } else if (recurrence.freq === 'biweekly') {
        recurrenceRule = `FREQ=WEEKLY;INTERVAL=2;COUNT=${count}`
        for (let i = 1; i < count; i++) {
          const d = new Date(startDate)
          d.setUTCDate(d.getUTCDate() + 14 * i)
          occurrences.push(d)
        }
      } else if (recurrence.freq === 'monthly') {
        recurrenceRule = `FREQ=MONTHLY;COUNT=${count}`
        for (let i = 1; i < count; i++) {
          const d = new Date(startDate)
          d.setUTCMonth(d.getUTCMonth() + i)
          occurrences.push(d)
        }
      }
    }
  }

  const seriesId = occurrences.length > 1 ? crypto.randomUUID() : null
  const paymentLinkOverride = body?.payment_link?.trim() || null

  // Insert all rows as 'pending' first; recomputeQuotaAssignment below
  // walks every booking for this coach+client+service in start_at order
  // and assigns 'included' to the first N where N = quota_total.
  const rows = occurrences.map((d, idx) => ({
    coach_id: coachId,
    client_id: clientId,
    service_id: service.id,
    service_name: service.name,
    service_color: service.color ?? '#1D9E75',
    start_at: d.toISOString(),
    duration_minutes: durationMinutes,
    coach_tz: coachTz,
    client_tz: clientTz,
    status: 'confirmed',
    payment_status: 'pending' as const,
    series_id: seriesId,
    // RRULE only on the first row of a series so cancellations of later
    // rows don't lose the series-level metadata.
    recurrence_rule: idx === 0 ? recurrenceRule : null,
    location: body?.location?.trim() || null,
    meeting_url: body?.meeting_url?.trim() || null,
    notes: body?.notes?.trim() || null,
    coach_notes: body?.coach_notes?.trim() || null,
    payment_link: paymentLinkOverride ?? service.payment_link,
  }))

  const { data, error } = await supabase.from('bookings').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Recompute who occupies quota slots across the whole client+service.
  await recomputeQuotaAssignment(supabase, { coachId, clientId, serviceId: service.id })

  // Return refreshed rows so the caller sees the assigned payment_status.
  const insertedIds = (data ?? []).map((r) => r.id)
  const { data: refreshed } = await supabase.from('bookings').select('*').in('id', insertedIds)
  return NextResponse.json({ bookings: refreshed ?? data ?? [] })
}
