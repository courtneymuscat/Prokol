import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

// wl_starter/wl_pro are real, paid Stripe tiers ($299/$499 AUD per month —
// see lib/stripe.ts, app/components/BillingSection.tsx). Applying for
// white-label requires already being on one of them, via the existing
// self-serve /api/stripe/checkout flow — this route no longer gates on
// coach_business, and no longer accepts a free-text requested tier.
const TIER_TO_REQUESTED: Record<string, 'starter' | 'pro'> = {
  wl_starter: 'starter',
  wl_pro: 'pro',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify org ownership + paid white-label tier
  const { data: profile } = await admin
    .from('profiles')
    .select('org_id, subscription_tier')
    .eq('id', session.user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
  }
  const requestedTier = TIER_TO_REQUESTED[profile.subscription_tier ?? '']
  if (!requestedTier) {
    return NextResponse.json({ error: 'A white-label plan (Web or App Store) is required' }, { status: 403 })
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
  const brandColour = (formData.get('brandColour') as string)?.trim()
  const brandColourSecondary = (formData.get('brandColourSecondary') as string)?.trim() || null
  const supportEmail = (formData.get('supportEmail') as string)?.trim()
  const logoFile = formData.get('logo') as File | null
  const faviconFile = formData.get('favicon') as File | null
  const appIconFile = formData.get('appIcon') as File | null

  // Validate required fields
  if (!appName || !brandColour || !supportEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  async function uploadAsset(file: File | null, name: string): Promise<string | null> {
    if (!file || file.size === 0) return null
    if (file.size > MAX_FILE_SIZE) throw new Error(`${name} file too large (max 2 MB)`)
    const ext = file.name.split('.').pop()
    const path = `white-label/${profile!.org_id}/${name}.${ext}`
    const { error: uploadError } = await admin.storage
      .from('org-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) return null
    const { data: urlData } = admin.storage.from('org-assets').getPublicUrl(path)
    return urlData.publicUrl
  }

  let logoUrl: string | null = null
  let faviconUrl: string | null = null
  let appIconUrl: string | null = null
  try {
    logoUrl = await uploadAsset(logoFile, 'logo')
    faviconUrl = await uploadAsset(faviconFile, 'favicon')
    appIconUrl = await uploadAsset(appIconFile, 'app-icon')
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 })
  }

  // Create application record
  const { data: application, error: insertError } = await admin
    .from('white_label_applications')
    .insert({
      org_id: profile.org_id,
      app_name: appName,
      brand_colour: brandColour,
      brand_colour_secondary: brandColourSecondary,
      logo_url: logoUrl,
      favicon_url: faviconUrl,
      app_icon_url: appIconUrl,
      support_email: supportEmail,
      requested_tier: requestedTier,
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
      <p><strong>Plan:</strong> ${requestedTier === 'pro' ? 'App Store White-label ($499/mo)' : 'Web White-label ($299/mo)'}</p>
      <p><strong>Support email:</strong> ${supportEmail}</p>
      <p><strong>Brand colour:</strong> ${brandColour}</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://prokol.io'}/admin/white-label">Review in admin dashboard →</a></p>
    `,
  })

  return NextResponse.json({ success: true, status: 'pending', id: application.id })
}
