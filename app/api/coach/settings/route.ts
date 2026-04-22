import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, timezone, subscription_tier, brand_colour, logo_url, brand_name')
    .eq('id', coachId)
    .single()

  return Response.json({
    email: user?.email ?? '',
    first_name: profile?.first_name ?? '',
    timezone: profile?.timezone ?? null,
    subscription_tier: profile?.subscription_tier ?? 'individual_free',
    brand_colour: profile?.brand_colour ?? null,
    logo_url: profile?.logo_url ?? null,
    brand_name: (profile as Record<string, unknown>)?.brand_name as string | null ?? null,
  })
}

export async function PUT(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { first_name, timezone, brand_colour, logo_url, brand_name } = body

  // Use admin client to bypass any RLS column restrictions on branding fields
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const updates: Record<string, unknown> = {}
  if (first_name !== undefined) updates.first_name = first_name?.trim() || null
  if (timezone !== undefined) updates.timezone = timezone || null
  if (brand_colour !== undefined) updates.brand_colour = brand_colour || null
  if (logo_url !== undefined) updates.logo_url = logo_url || null
  if (brand_name !== undefined) updates.brand_name = brand_name?.trim() || null

  const { error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { timezone } = await req.json()
  if (!timezone) return Response.json({ error: 'timezone required' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
