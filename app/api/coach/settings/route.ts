import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { getOrgForUser } from '@/lib/org'
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

  // If this coach is a non-owner member of an organisation, surface the org's
  // branding so the settings page can show it read-only.
  const membership = await getOrgForUser(coachId)
  let org_managed: {
    org_name: string
    role: string
    brand_colour: string | null
    logo_url: string | null
    brand_name: string | null
  } | null = null
  // Once an org goes white-label, its organisations.* branding overrides
  // this personal profiles.* branding everywhere in the app shell for
  // EVERY member — owner included (see lib/whitelabel.ts's
  // getOrgBrandingForUser, keyed off profiles.org_id with no role check).
  // So the personal "Branding" form below becomes dead weight the moment
  // white-label is on, regardless of who owns the org — it needs its own
  // distinct notice rather than falling into the member-vs-owner branches
  // below, which assume the personal fields still matter.
  let white_label_override: {
    org_name: string
    app_name: string | null
    brand_colour: string | null
    logo_url: string | null
  } | null = null

  if (membership) {
    const admin = createAdminClient()
    const { data: org } = await admin
      .from('organisations')
      .select('is_white_label, name, app_name, brand_colour, logo_url')
      .eq('id', membership.org_id)
      .single()

    if (org?.is_white_label) {
      white_label_override = {
        org_name: membership.org_name,
        app_name: org.app_name ?? null,
        brand_colour: org.brand_colour ?? null,
        logo_url: org.logo_url ?? null,
      }
    } else if (membership.role !== 'owner') {
      const { data: ownerMember } = await admin
        .from('org_members')
        .select('user_id')
        .eq('org_id', membership.org_id)
        .eq('role', 'owner')
        .maybeSingle()
      let ownerBranding: { brand_colour: string | null; logo_url: string | null; brand_name: string | null } | null = null
      if (ownerMember?.user_id) {
        const { data } = await admin
          .from('profiles')
          .select('brand_colour, logo_url, brand_name')
          .eq('id', ownerMember.user_id)
          .single()
        ownerBranding = data ?? null
      }
      org_managed = {
        org_name: membership.org_name,
        role: membership.role,
        brand_colour: ownerBranding?.brand_colour ?? null,
        logo_url: ownerBranding?.logo_url ?? null,
        brand_name: ownerBranding?.brand_name ?? membership.org_name,
      }
    }
  }

  return Response.json({
    email: user?.email ?? '',
    first_name: profile?.first_name ?? '',
    timezone: profile?.timezone ?? null,
    subscription_tier: profile?.subscription_tier ?? 'individual_free',
    brand_colour: profile?.brand_colour ?? null,
    logo_url: profile?.logo_url ?? null,
    brand_name: (profile as Record<string, unknown>)?.brand_name as string | null ?? null,
    org_managed,
    white_label_override,
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

  // Personal branding fields are a no-op once the coach's org is
  // white-labelled — organisations.* branding overrides them everywhere
  // (see GET above), so silently persisting them here would just be dead
  // data the coach thinks is live. Blocked server-side, not just hidden in
  // the UI, so a stale page or direct API call can't resurrect them either.
  const wantsBrandingChange = brand_colour !== undefined || logo_url !== undefined || brand_name !== undefined
  if (wantsBrandingChange) {
    const membership = await getOrgForUser(coachId)
    if (membership) {
      const { data: org } = await admin
        .from('organisations')
        .select('is_white_label')
        .eq('id', membership.org_id)
        .single()
      if (org?.is_white_label) {
        return Response.json({
          error: 'Branding is managed by your white-label settings, not here.',
        }, { status: 400 })
      }
    }
  }

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
