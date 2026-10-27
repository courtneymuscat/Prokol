import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/client/serve-targets — client fetches their own serve targets (set by coach)
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ targets: null })

  const { data } = await supabase
    .from('client_serve_targets')
    .select('protein_serves, carb_serves, fat_serves, veg_unlimited, notes')
    .eq('client_id', session.user.id)
    .single()

  return NextResponse.json({ targets: data ?? null })
}
