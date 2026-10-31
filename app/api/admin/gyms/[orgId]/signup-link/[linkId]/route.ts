import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ orgId: string; linkId: string }> }

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
  const { orgId, linkId } = await params

  const body = await req.json() as { name?: string }
  const admin = createAdminClient()
  const { error } = await admin
    .from('org_signup_links')
    .update({ name: body.name?.trim() || null })
    .eq('id', linkId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const adminId = await requirePlatformAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { orgId, linkId } = await params

  const admin = createAdminClient()
  const { error } = await admin
    .from('org_signup_links')
    .delete()
    .eq('id', linkId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
