import type { SupabaseClient } from '@supabase/supabase-js'

// Re-assign auto payment_status across all of a client's bookings for a
// given service. Called whenever bookings are created or cancelled so that
// when a booking is cancelled, its included slot is handed to the next
// pending booking in chronological order.
//
// Rules:
//  • cancelled bookings don't count toward quota
//  • confirmed/completed/no_show/late_cancel all consume a quota slot
//  • only payment_status of 'pending' or 'included' is auto-managed —
//    'paid', 'waived', and 'refunded' are coach overrides and stay put
//  • if service.billing_mode = 'subscription' and quota_total is NULL,
//    every non-overridden booking becomes 'included' (unlimited)
//  • if billing_mode = 'separate', every non-overridden booking stays
//    'pending' (no quota concept applies)
export async function recomputeQuotaAssignment(
  supabase: SupabaseClient,
  args: { coachId: string; clientId: string; serviceId: string },
): Promise<void> {
  const { coachId, clientId, serviceId } = args
  if (!serviceId) return

  const { data: service } = await supabase
    .from('booking_services')
    .select('billing_mode, quota_total')
    .eq('id', serviceId)
    .eq('coach_id', coachId)
    .maybeSingle<{ billing_mode: 'subscription' | 'separate'; quota_total: number | null }>()

  if (!service) return

  const { data: rows } = await supabase
    .from('bookings')
    .select('id, start_at, status, payment_status')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('service_id', serviceId)
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true })

  if (!rows) return

  const includedTarget =
    service.billing_mode === 'subscription'
      ? (service.quota_total == null ? Infinity : service.quota_total)
      : 0

  // Counter only advances for rows we're allowed to flip — manual
  // overrides (paid/waived/refunded) don't consume a slot from the
  // auto-assignment perspective.
  let assigned = 0
  const flips: { id: string; payment_status: 'included' | 'pending' }[] = []
  for (const row of rows) {
    if (row.payment_status === 'paid' || row.payment_status === 'waived' || row.payment_status === 'refunded') {
      continue
    }
    const shouldBe: 'included' | 'pending' = assigned < includedTarget ? 'included' : 'pending'
    if (shouldBe === 'included') assigned += 1
    if (row.payment_status !== shouldBe) {
      flips.push({ id: row.id, payment_status: shouldBe })
    }
  }

  if (flips.length === 0) return

  // Run updates in parallel — each row keys on its own id so they're
  // independent.
  await Promise.all(
    flips.map((f) =>
      supabase
        .from('bookings')
        .update({ payment_status: f.payment_status, updated_at: new Date().toISOString() })
        .eq('id', f.id)
        .eq('coach_id', coachId),
    ),
  )
}
