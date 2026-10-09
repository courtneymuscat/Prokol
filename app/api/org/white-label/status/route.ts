import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('org_id, subscription_tier')
    .eq('id', session.user.id)
    .single()

  const subscriptionTier = profile?.subscription_tier ?? null
  const hasWhiteLabelTier = subscriptionTier === 'wl_starter' || subscriptionTier === 'wl_pro'

  if (!profile?.org_id) {
    return NextResponse.json({ application: null, subscriptionTier, hasWhiteLabelTier })
  }

  const { data: application } = await admin
    .from('white_label_applications')
    .select('id, status, app_name, submitted_at, rejection_reason')
    .eq('org_id', profile.org_id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  // The application's own status ("approved") is a historical record — it
  // stays "approved" even after an admin later revokes white-label (see
  // revokeWhiteLabel), so it must never be used on its own to decide
  // whether to show the "live" view. organisations.is_white_label is the
  // only source of truth for what's actually switched on right now.
  let isLive = false
  let liveBranding: {
    app_name: string | null
    brand_colour: string | null
    brand_colour_secondary: string | null
    support_email: string | null
    logo_url: string | null
    favicon_url: string | null
    app_icon_url: string | null
  } | null = null

  if (application?.status === 'approved') {
    const { data: org } = await admin
      .from('organisations')
      .select('is_white_label, app_name, brand_colour, brand_colour_secondary, support_email, logo_url, favicon_url, app_icon_url')
      .eq('id', profile.org_id)
      .single()

    isLive = org?.is_white_label ?? false
    if (isLive) {
      liveBranding = {
        app_name: org?.app_name ?? null,
        brand_colour: org?.brand_colour ?? null,
        brand_colour_secondary: org?.brand_colour_secondary ?? null,
        support_email: org?.support_email ?? null,
        logo_url: org?.logo_url ?? null,
        favicon_url: org?.favicon_url ?? null,
        app_icon_url: org?.app_icon_url ?? null,
      }
    }
  }

  return NextResponse.json({
    application,
    subscriptionTier,
    hasWhiteLabelTier,
    isLive,
    liveBranding,
  })
}
