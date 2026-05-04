import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify org ownership
  const { data: profile } = await admin
    .from('profiles')
    .select('org_id, subscription_tier')
    .eq('id', session.user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
  }
  if (profile.subscription_tier !== 'coach_business') {
    return NextResponse.json({ error: 'Coach Business plan required' }, { status: 403 })
  }

  // Check for existing pending/approved application
  const { data: existingApp } = await admin
    .from('white_label_applications')
    .select('id, status')
    .eq('org_id', profile.org_id)
    .in('status', ['pending', 'approved'])
    .limit(1)
    .single()

  if (existingApp) {
    return NextResponse.json(
      { error: 'An application already exists for this organisation' },
      { status: 400 },
    )
  }

  // Parse multipart form
  const formData = await req.formData()
  const appName = (formData.get('appName') as string)?.trim()
  const customDomain = (formData.get('customDomain') as string)?.trim().toLowerCase()
  const brandColour = (formData.get('brandColour') as string)?.trim()
  const brandColourSecondary = (formData.get('brandColourSecondary') as string)?.trim() || null
  const supportEmail = (formData.get('supportEmail') as string)?.trim()
  const logoFile = formData.get('logo') as File | null
  const faviconFile = formData.get('favicon') as File | null

  // Validate required fields
  if (!appName || !customDomain || !brandColour || !supportEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Basic domain format validation
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/.test(customDomain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
  }

  // Check domain not already in use
  const { data: existingDomain } = await admin
    .from('organisations')
    .select('id')
    .eq('custom_domain', customDomain)
    .limit(1)
    .single()

  if (existingDomain) {
    return NextResponse.json({ error: 'This domain is already in use' }, { status: 400 })
  }

  // Upload logo if provided
  let logoUrl: string | null = null
  if (logoFile && logoFile.size > 0) {
    if (logoFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Logo file too large (max 2 MB)' }, { status: 400 })
    }
    const ext = logoFile.name.split('.').pop()
    const path = `white-label/${profile.org_id}/logo.${ext}`
    const { error: uploadError } = await admin.storage
      .from('org-assets')
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
    if (!uploadError) {
      const { data: urlData } = admin.storage.from('org-assets').getPublicUrl(path)
      logoUrl = urlData.publicUrl
    }
  }

  // Upload favicon if provided
  let faviconUrl: string | null = null
  if (faviconFile && faviconFile.size > 0) {
    if (faviconFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Favicon file too large (max 2 MB)' }, { status: 400 })
    }
    const ext = faviconFile.name.split('.').pop()
    const path = `white-label/${profile.org_id}/favicon.${ext}`
    const { error: uploadError } = await admin.storage
      .from('org-assets')
      .upload(path, faviconFile, { upsert: true, contentType: faviconFile.type })
    if (!uploadError) {
      const { data: urlData } = admin.storage.from('org-assets').getPublicUrl(path)
      faviconUrl = urlData.publicUrl
    }
  }

  // Create application record
  const { data: application, error: insertError } = await admin
    .from('white_label_applications')
    .insert({
      org_id: profile.org_id,
      app_name: appName,
      custom_domain: customDomain,
      brand_colour: brandColour,
      brand_colour_secondary: brandColourSecondary,
      logo_url: logoUrl,
      favicon_url: faviconUrl,
      support_email: supportEmail,
      requested_tier: 'starter',
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Get org name for email
  const { data: org } = await admin
    .from('organisations')
    .select('name')
    .eq('id', profile.org_id)
    .single()

  // Notify platform admin
  await sendEmail({
    to: 'court@prokol.io',
    subject: `New white-label application: ${appName}`,
    html: `
      <h2>New white-label application</h2>
      <p><strong>App name:</strong> ${appName}</p>
      <p><strong>Organisation:</strong> ${org?.name ?? profile.org_id}</p>
      <p><strong>Domain:</strong> ${customDomain}</p>
      <p><strong>Support email:</strong> ${supportEmail}</p>
      <p><strong>Brand colour:</strong> ${brandColour}</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://prokol.io'}/admin/white-label">Review in admin dashboard →</a></p>
    `,
  })

  return NextResponse.json({ success: true, status: 'pending', id: application.id })
}
