import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/client/bookings?from=ISO&to=ISO — client reads their own bookings.
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? new Date().toISOString()
  const to = searchParams.get('to')

  let q = supabase
    .from('bookings')
    .select('id, service_name, service_color, start_at, duration_minutes, client_tz, status, payment_status, location, meeting_url, notes, payment_link')
    .eq('client_id', user.id)
    .gte('start_at', from)
    .order('start_at', { ascending: true })
  if (to) q = q.lte('start_at', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ bookings: data ?? [] })
}
