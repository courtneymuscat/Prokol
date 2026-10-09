import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createGymOrg } from '@/lib/admin'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

/**
 * Creates a gym organisation from Admin Mode, with optional branding
 * assets uploaded in the same request. Org creation happens first (via
 * createGymOrg, text fields only) to get an id, then any provided files
 * are uploaded to the same org-assets bucket/path convention as the
 * self-serve white-label apply flow (app/api/org/white-label/apply),
 * and the org row is updated with the resulting URLs.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()
  if (adminProfile?.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const name = (formData.get('name') as string | null) ?? ''
  const appName = (formData.get('appName') as string | null) || null
  const brandColour = (formData.get('brandColour') as string | null) || null
  const brandColourSecondary = (formData.get('brandColourSecondary') as string | null) || null
  const supportEmail = (formData.get('supportEmail') as string | null) || null
  const logoFile = formData.get('logo') as File | null
  const faviconFile = formData.get('favicon') as File | null
  const appIconFile = formData.get('appIcon') as File | null

  const created = await createGymOrg(
    { name, appName, brandColour, brandColourSecondary, supportEmail },
    session.user.id,
  )
  if (created.error || !created.data) {
    return NextResponse.json({ error: created.error ?? 'Failed to create gym' }, { status: 400 })
  }
  const orgId = created.data.id

  async function uploadAsset(file: File | null, assetName: string): Promise<string | null> {
    if (!file || file.size === 0) return null
    if (file.size > MAX_FILE_SIZE) throw new Error(`${assetName} file too large (max 2 MB)`)
    const ext = file.name.split('.').pop()
    const path = `white-label/${orgId}/${assetName}.${ext}`
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
    // The org already exists at this point — upload failure doesn't roll
    // it back, since branding can always be edited after the fact. Just
    // surface the error so the admin knows to retry the asset upload.
    return NextResponse.json({
      id: orgId,
      slug: created.data.slug,
      warning: err instanceof Error ? err.message : 'Branding upload failed',
    }, { status: 207 })
  }

  if (logoUrl || faviconUrl || appIconUrl) {
    await admin.from('organisations').update({
      ...(logoUrl ? { logo_url: logoUrl } : {}),
      ...(faviconUrl ? { favicon_url: faviconUrl } : {}),
      ...(appIconUrl ? { app_icon_url: appIconUrl } : {}),
    }).eq('id', orgId)
  }

  return NextResponse.json({ id: orgId, slug: created.data.slug })
}
