import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ orgId: string; announcementId: string }> }

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).single()
  return profile?.role === 'platform_admin' ? session.user.id : null
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const adminId = await requirePlatformAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { orgId, announcementId } = await params

  const body = await req.json() as { title?: string; url?: string; note?: string }
  const patch: Record<string, unknown> = {}
  if ('title' in body) patch.title = body.title?.trim()
  if ('url' in body) patch.url = body.url?.trim() || null
  if ('note' in body) patch.note = body.note?.trim() || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('org_announcements')
    .update(patch)
    .eq('id', announcementId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Archives rather than hard-deletes — nothing a client may have already
// seen just vanishes without a trace, same posture as everywhere else
// client-visible content gets "removed" in this app.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const adminId = await requirePlatformAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { orgId, announcementId } = await params

  const admin = createAdminClient()
  const { error } = await admin
    .from('org_announcements')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', announcementId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
