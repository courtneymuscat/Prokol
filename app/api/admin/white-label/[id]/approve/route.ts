import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { addDomainToVercel } from '@/lib/vercel'

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

  // Update the organisation with white-label branding
  await admin
    .from('organisations')
    .update({
      is_white_label: true,
      white_label_tier: 'starter',
      app_name: app.app_name,
      custom_domain: app.custom_domain,
      brand_colour: app.brand_colour,
      brand_colour_secondary: app.brand_colour_secondary,
      logo_url: app.logo_url,
      favicon_url: app.favicon_url,
      support_email: app.support_email,
    })
    .eq('id', app.org_id)

  // Add domain to Vercel
  const vercelResult = await addDomainToVercel(app.custom_domain)
  if (vercelResult.error) {
    console.error('Vercel domain add failed:', vercelResult.error)
    // Non-fatal — admin can retry manually
  }

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
          <p>Your white-label setup for <strong>${app.app_name}</strong> has been approved.</p>
          <p>To go live, add the following DNS record to your domain provider:</p>
          <table style="border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Type</td><td>CNAME</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Host</td><td>app (or @ for root)</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Value</td><td>cname.vercel-dns.com</td></tr>
          </table>
          <p>Once you&apos;ve added the record, reply to this email and we&apos;ll activate your domain within 24 hours.</p>
          <p>Your domain: <strong>${app.custom_domain}</strong></p>
          <p>Questions? Email <a href="mailto:courtney@prokol.io">courtney@prokol.io</a></p>
        `,
      })
    }
  }

  return NextResponse.json({ success: true })
}
