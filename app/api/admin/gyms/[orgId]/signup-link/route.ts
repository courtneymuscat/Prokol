import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ orgId: string }> }

/**
 * Creates a reusable signup link for a gym — a code anyone can use to sign
 * up and be automatically enrolled in the chosen autoflow(s). Starting
 * macros are deliberately not set here: a gym has no coaching staff to
 * hand-pick them, so each member gets their own targets from the
 * self-service TDEE onboarding flow they complete right after signing up
 * (see lib/coach.ts's acceptOrgSignupLink for why onboarding_completed is
 * left false for this signup path specifically).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { orgId } = await params
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

  const body = await req.json() as { autoflowIds?: string[] }
  const autoflowIds = Array.isArray(body.autoflowIds) ? body.autoflowIds.filter(Boolean) : []

  // Short, URL-safe, collision-checked code — not a guessable sequential id,
  // since this is a standing link anyone with it can use indefinitely.
  let code = Math.random().toString(36).slice(2, 10)
  const { data: existing } = await admin.from('org_signup_links').select('id').eq('code', code).maybeSingle()
  if (existing) code = `${code}${Math.random().toString(36).slice(2, 6)}`

  const { data: link, error } = await admin
    .from('org_signup_links')
    .insert({ org_id: orgId, code, created_by: session.user.id })
    .select('id, code')
    .single()

  if (error || !link) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create signup link' }, { status: 500 })
  }

  if (autoflowIds.length > 0) {
    await admin.from('org_signup_link_autoflows').insert(
      autoflowIds.map((autoflowId) => ({ link_id: link.id, autoflow_id: autoflowId }))
    )
  }

  return NextResponse.json({ id: link.id, code: link.code })
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { orgId } = await params
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

  const { data: links } = await admin
    .from('org_signup_links')
    .select('id, code, is_active, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return NextResponse.json(links ?? [])
}
