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
    .select('id, status, app_name, custom_domain, submitted_at, rejection_reason')
    .eq('org_id', profile.org_id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  // Once an org is approved, the free {slug}.prokol.io subdomain is live
  // immediately — no custom domain or DNS step required. Looked up here so
  // the page can show it without a second round trip.
  let subdomain: string | null = null
  if (application?.status === 'approved') {
    const { data: org } = await admin.from('organisations').select('slug').eq('id', profile.org_id).single()
    subdomain = org?.slug ? `${org.slug}.prokol.io` : null
  }

  return NextResponse.json({ application: application ?? null, subscriptionTier, hasWhiteLabelTier, subdomain })
}
