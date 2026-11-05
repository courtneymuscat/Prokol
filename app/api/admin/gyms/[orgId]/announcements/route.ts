import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ orgId: string }> }

async function requirePlatformAdminSession(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const admin = createAdminClient()
  const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', session.user.id).single()
  return adminProfile?.role === 'platform_admin' ? session.user.id : null
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { orgId } = await params
  const adminId = await requirePlatformAdminSession()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('org_announcements')
    .select('id, title, url, note, created_at, archived_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { orgId } = await params
  const adminId = await requirePlatformAdminSession()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { title?: string; url?: string; note?: string }
  const title = body.title?.trim()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('org_announcements')
    .insert({
      org_id: orgId,
      title,
      url: body.url?.trim() || null,
      note: body.note?.trim() || null,
      posted_by: adminId,
    })
    .select('id, title, url, note, created_at, archived_at')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to post announcement' }, { status: 500 })
  return NextResponse.json(data)
}
