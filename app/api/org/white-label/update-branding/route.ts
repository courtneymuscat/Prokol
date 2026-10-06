import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyClientsOfBrandingChange } from '@/lib/whitelabel'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

// Editing branding after approval doesn't need to go back through admin
// review — Court already vetted the business and its content once at
// application time; letting them tweak their own logo/colours afterward
// is the same self-serve bar as the old profile-level Settings > Branding
// feature, just scoped to the whole org instead of one coach.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('org_id')
    .eq('id', session.user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
  }

  const { data: current } = await admin
    .from('organisations')
    .select('is_white_label, app_name, logo_url, favicon_url, app_icon_url')
    .eq('id', profile.org_id)
    .single()

  if (!current?.is_white_label) {
    return NextResponse.json({ error: 'White-label is not active for this organisation' }, { status: 403 })
  }

  const formData = await req.formData()
  const appName = (formData.get('appName') as string)?.trim()
  const brandColour = (formData.get('brandColour') as string)?.trim()
  const brandColourSecondary = (formData.get('brandColourSecondary') as string)?.trim() || null
  const supportEmail = (formData.get('supportEmail') as string)?.trim()
  const logoFile = formData.get('logo') as File | null
  const faviconFile = formData.get('favicon') as File | null
  const appIconFile = formData.get('appIcon') as File | null

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

  let logoUrl: string | null
  let faviconUrl: string | null
  let appIconUrl: string | null
  try {
    // A missing file means "leave it as-is", not "clear it" — only a fresh
    // upload replaces an existing asset.
    logoUrl = (await uploadAsset(logoFile, 'logo')) ?? current.logo_url
    faviconUrl = (await uploadAsset(faviconFile, 'favicon')) ?? current.favicon_url
    appIconUrl = (await uploadAsset(appIconFile, 'app-icon')) ?? current.app_icon_url
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 })
  }

  const { error } = await admin
    .from('organisations')
    .update({
      app_name: appName,
      brand_colour: brandColour,
      brand_colour_secondary: brandColourSecondary,
      support_email: supportEmail,
      logo_url: logoUrl,
      favicon_url: faviconUrl,
      app_icon_url: appIconUrl,
    })
    .eq('id', profile.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Only the home-screen-icon email is worth sending — a colour tweak
  // doesn't require anyone to remove and re-add their icon, but a changed
  // name or icon/favicon does (same reasoning as the approval/reinstate
  // trigger in notifyClientsOfBrandingChange's own docs).
  const iconRelevantChange =
    appName !== current.app_name ||
    faviconUrl !== current.favicon_url ||
    appIconUrl !== current.app_icon_url

  if (iconRelevantChange) {
    await notifyClientsOfBrandingChange(profile.org_id).catch((err) => {
      console.error('[update-branding] notifyClientsOfBrandingChange failed:', err)
    })
  }

  return NextResponse.json({ success: true })
}
