import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/client/serve-targets — client fetches their own serve targets
// (set by coach). The coach can hide these from the client's own app
// without deleting them (coach_clients.show_serve_targets, defaults true)
// — every client-facing consumer of this route (ClientCheatSheet.tsx,
// DailyLog.tsx) already treats targets: null as "nothing set", so this is
// the single place that needs to know about the toggle at all.
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ targets: null })

  const [{ data }, { data: rel }] = await Promise.all([
    supabase
      .from('client_serve_targets')
      .select('protein_serves, carb_serves, fat_serves, veg_unlimited, notes')
      .eq('client_id', session.user.id)
      .maybeSingle(),
    supabase
      .from('coach_clients')
      .select('show_serve_targets')
      .eq('client_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const visible = rel?.show_serve_targets !== false
  return NextResponse.json({ targets: visible ? (data ?? null) : null })
}
