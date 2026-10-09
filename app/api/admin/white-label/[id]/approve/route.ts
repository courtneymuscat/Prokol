import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { notifyClientsOfBrandingChange } from '@/lib/whitelabel'
import { WHITE_LABEL_COACH_SEAT_LIMIT } from '@/lib/billing'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify platform admin
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('role, email')
    .eq('id', session.user.id)
    .single()

  if (adminProfile?.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Fetch the application
  const { data: app } = await admin
    .from('white_label_applications')
    .select('*, organisations(name, owner_id)')
    .eq('id', id)
    .single()

  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  if (app.status !== 'pending') {
    return NextResponse.json({ error: 'Application is not pending' }, { status: 400 })
  }

  // Update application status
  await admin
    .from('white_label_applications')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.id,
    })
    .eq('id', id)

  // Update the organisation with white-label branding. white_label_tier
  // comes from what they actually paid for (requested_tier was derived from
  // their wl_starter/wl_pro Stripe subscription at apply time), not
  // hardcoded — approving used to always grant 'starter' regardless of
  // which plan was requested.
  await admin
    .from('organisations')
    .update({
      is_white_label: true,
      white_label_tier: app.requested_tier,
      app_name: app.app_name,
      brand_colour: app.brand_colour,
      brand_colour_secondary: app.brand_colour_secondary,
      logo_url: app.logo_url,
      favicon_url: app.favicon_url,
      app_icon_url: app.app_icon_url,
      support_email: app.support_email,
      // White-label's coach allowance (5 for starter, 10 for pro) is higher
      // than Business's — this used to never get applied, leaving a
      // white-label org stuck at the Business default of 3.
      coach_seat_limit: WHITE_LABEL_COACH_SEAT_LIMIT[app.requested_tier as 'starter' | 'pro'],
    })
    .eq('id', app.org_id)

  // Tells existing active clients that if they've already pinned the app to
  // their home screen, they need to remove and re-add it to pick up the new
  // icon/name (a platform limitation — manifests are snapshotted at install
  // time, not re-fetched).
  await notifyClientsOfBrandingChange(app.org_id).catch((err) => {
    console.error('[approve] notifyClientsOfBrandingChange failed:', err)
    return { sent: 0 }
  })

  // Get org owner email
  const orgData = app.organisations as { name: string; owner_id: string } | null

  if (orgData?.owner_id) {
    const { data: ownerProfile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', orgData.owner_id)
      .single()

    if (ownerProfile?.email) {
      await sendEmail({
        to: ownerProfile.email,
        subject: `Your white-label application for ${app.app_name} has been approved`,
        html: `
          <h2>Your white-label application is approved!</h2>
          <p>Hi ${ownerProfile.full_name ?? 'there'},</p>
          <p>Your white-label setup for <strong>${app.app_name}</strong> has been approved and is live — nothing else to do. You and your clients will see your branding automatically the moment you're logged in, on the app you already use.</p>
          <p>Questions? Email <a href="mailto:info@prokol.io">info@prokol.io</a></p>
        `,
      })
    }
  }

  return NextResponse.json({ success: true })
}
