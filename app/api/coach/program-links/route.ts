import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

// Individual (non-gym) signup links — Court selling a bundle of one or
// more autoflows ("a course") directly to individuals, no org involved,
// optionally priced (omitted/0 = free, same as a gym link). Deliberately
// platform-admin gated rather than requireCoach()-gated: per Court's
// explicit "just me for now" call, this isn't opened to other coaches
// yet. The authorization check is a single, isolated line here if that
// ever needs to change.
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
    .select('id, code, name, description, price_cents, currency, is_active, created_at, org_signup_link_autoflows(autoflow_id)')
    .eq('coach_id', adminId)
    .is('org_id', null)
    .order('created_at', { ascending: false })

  type LinkRow = {
    id: string; code: string; name: string | null; description: string | null
    price_cents: number | null; currency: string; is_active: boolean; created_at: string
    org_signup_link_autoflows: { autoflow_id: string }[]
  }
  const rows = (links ?? []) as unknown as LinkRow[]

  // ?autoflow_id= narrows to courses that include that autoflow (used by
  // the template editor's shortcut); omitted, every course for this coach
  // comes back (used by the /admin/courses management page).
  const filtered = autoflowId
    ? rows.filter((l) => l.org_signup_link_autoflows.some((a) => a.autoflow_id === autoflowId))
    : rows

  return Response.json(
    filtered.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      description: l.description,
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

  const body = await req.json() as {
    autoflowIds?: string[]; priceCents?: number; currency?: string; name?: string; description?: string
  }
  const autoflowIds = Array.isArray(body.autoflowIds) ? body.autoflowIds.filter(Boolean) : []
  if (autoflowIds.length === 0) return Response.json({ error: 'At least one autoflow is required' }, { status: 400 })

  // Optional — omitted or 0 makes a free course, same semantics a gym
  // link already uses.
  const priceCents = typeof body.priceCents === 'number' && body.priceCents > 0 ? Math.round(body.priceCents) : null

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
      name: body.name?.trim() || null,
      description: body.description?.trim() || null,
      price_cents: priceCents,
      currency: body.currency || 'aud',
    })
    .select('id, code')
    .single()

  if (error || !link) return Response.json({ error: error?.message ?? 'Failed to create signup link' }, { status: 500 })

  await admin.from('org_signup_link_autoflows').insert(
    autoflowIds.map((autoflowId) => ({ link_id: link.id, autoflow_id: autoflowId })),
  )

  return Response.json({ id: link.id, code: link.code })
}
