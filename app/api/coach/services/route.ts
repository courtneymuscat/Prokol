import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { fetchOrgTemplatesForCoach } from '@/lib/org'
import type { NextRequest } from 'next/server'

const SERVICE_TIERS = new Set(['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'])

type ServiceRow = {
  id: string
  name: string
  description: string | null
  price_label: string | null
  payment_link: string | null
  tos_url: string | null
  created_at: string
}

async function checkServiceTier(coachId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', coachId)
    .single()
  return SERVICE_TIERS.has(data?.subscription_tier ?? '')
}

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const [{ data, error }, orgItems] = await Promise.all([
    supabase
      .from('coach_services')
      .select('id, name, description, price_label, payment_link, tos_url, created_at')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: true }),
    fetchOrgTemplatesForCoach<ServiceRow>(
      coachId,
      'coach_services',
      'id, name, description, price_label, payment_link, tos_url, created_at',
    ),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const merged = [
    ...orgItems.map((s) => ({ ...s, is_org_template: true })),
    ...((data as ServiceRow[] | null) ?? []).map((s) => ({ ...s, is_org_template: false })),
  ]
  return Response.json(merged)
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  if (!(await checkServiceTier(coachId))) {
    return Response.json({ error: 'Services require Coach Pro or Business plan' }, { status: 403 })
  }

  const { name, description, price_label, payment_link } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
  if (!payment_link?.trim()) return Response.json({ error: 'Payment link required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_services')
    .insert({
      coach_id: coachId,
      name: name.trim(),
      description: description?.trim() || null,
      price_label: price_label?.trim() || null,
      payment_link: payment_link.trim(),
    })
    .select('id, name, description, price_label, payment_link, tos_url, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
