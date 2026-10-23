import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

// Individual (non-gym) signup links — Court selling a specific autoflow
// directly to individuals, no org involved. Deliberately platform-admin
// gated rather than requireCoach()-gated: per Court's explicit "just me
// for now" call, this isn't opened to other coaches yet. The authorization
// check is a single, isolated line here if that ever needs to change.
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

export async function GET(req: NextRequest) {
  const adminId = await requirePlatformAdmin()
  if (!adminId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const autoflowId = searchParams.get('autoflow_id')

  const admin = createAdminClient()
  const { data: links } = await admin
    .from('org_signup_links')
    .select('id, code, price_cents, currency, is_active, created_at, org_signup_link_autoflows(autoflow_id)')
    .eq('coach_id', adminId)
    .is('org_id', null)
    .order('created_at', { ascending: false })

  type LinkRow = { id: string; code: string; price_cents: number | null; currency: string; is_active: boolean; created_at: string; org_signup_link_autoflows: { autoflow_id: string }[] }
  const rows = (links ?? []) as unknown as LinkRow[]

  const filtered = autoflowId
    ? rows.filter((l) => l.org_signup_link_autoflows.some((a) => a.autoflow_id === autoflowId))
    : rows

  return Response.json(
    filtered.map((l) => ({
      id: l.id,
      code: l.code,
      price_cents: l.price_cents,
      currency: l.currency,
      is_active: l.is_active,
      created_at: l.created_at,
      autoflow_ids: l.org_signup_link_autoflows.map((a) => a.autoflow_id),
    })),
  )
}

export async function POST(req: NextRequest) {
  const adminId = await requirePlatformAdmin()
  if (!adminId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { autoflowId?: string; priceCents?: number; currency?: string }
  const { autoflowId } = body
  const priceCents = Math.round(Number(body.priceCents))
  if (!autoflowId) return Response.json({ error: 'autoflowId required' }, { status: 400 })
  if (!priceCents || priceCents <= 0) return Response.json({ error: 'A positive priceCents is required' }, { status: 400 })

  const admin = createAdminClient()

  // Same collision-checked random code as the gym signup-link route.
  let code = Math.random().toString(36).slice(2, 10)
  const { data: existing } = await admin.from('org_signup_links').select('id').eq('code', code).maybeSingle()
  if (existing) code = `${code}${Math.random().toString(36).slice(2, 6)}`

  const { data: link, error } = await admin
    .from('org_signup_links')
    .insert({
      org_id: null,
      coach_id: adminId,
      code,
      created_by: adminId,
      price_cents: priceCents,
      currency: body.currency || 'aud',
    })
    .select('id, code')
    .single()

  if (error || !link) return Response.json({ error: error?.message ?? 'Failed to create signup link' }, { status: 500 })

  await admin.from('org_signup_link_autoflows').insert({ link_id: link.id, autoflow_id: autoflowId })

  return Response.json({ id: link.id, code: link.code })
}
