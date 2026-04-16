import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify platform admin
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (adminProfile?.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { reason } = await req.json()

  if (!reason?.trim()) {
    return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
  }

  const { data: app } = await admin
    .from('white_label_applications')
    .select('*, organisations(name, owner_id)')
    .eq('id', id)
    .single()

  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  await admin
    .from('white_label_applications')
    .update({
      status: 'rejected',
      rejection_reason: reason.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.id,
    })
    .eq('id', id)

  // Email org owner
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
        subject: `Update on your white-label application for ${app.app_name}`,
        html: `
          <h2>White-label application update</h2>
          <p>Hi ${ownerProfile.full_name ?? 'there'},</p>
          <p>Your white-label application for <strong>${app.app_name}</strong> was not approved at this time.</p>
          <p><strong>Reason:</strong> ${reason.trim()}</p>
          <p>If you have questions or would like to reapply, please contact <a href="mailto:courtney@prokol.io">courtney@prokol.io</a>.</p>
        `,
      })
    }
  }

  return NextResponse.json({ success: true })
}
