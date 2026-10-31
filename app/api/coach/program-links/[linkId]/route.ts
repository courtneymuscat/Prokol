import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

async function requirePlatformAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()
  return profile?.role === 'platform_admin' ? session.user.id : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  const adminId = await requirePlatformAdmin()
  if (!adminId) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { linkId } = await params

  const body = await req.json() as { name?: string; description?: string }
  const admin = createAdminClient()
  const { error } = await admin
    .from('org_signup_links')
    .update({
      name: body.name?.trim() || null,
      description: body.description?.trim() || null,
    })
    .eq('id', linkId)
    .eq('coach_id', adminId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  const adminId = await requirePlatformAdmin()
  if (!adminId) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { linkId } = await params

  const admin = createAdminClient()
  const { error } = await admin
    .from('org_signup_links')
    .delete()
    .eq('id', linkId)
    .eq('coach_id', adminId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
