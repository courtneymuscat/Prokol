import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ serviceId: string }> }

const SERVICE_TIERS = new Set(['coach_solo', 'coach_pt_solo', 'coach_nutritionist_solo', 'coach_pro', 'coach_business', 'wl_starter', 'wl_pro'])

async function checkServiceTier(coachId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', coachId)
    .single()
  return SERVICE_TIERS.has(data?.subscription_tier ?? '')
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { serviceId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  if (!(await checkServiceTier(coachId))) {
    return Response.json({ error: 'Services require Coach Pro or Business plan' }, { status: 403 })
  }

  const { name, description, price_label, payment_link } = await req.json()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_services')
    .update({
      name: name?.trim() || undefined,
      description: description?.trim() || null,
      price_label: price_label?.trim() || null,
      payment_link: payment_link?.trim() || undefined,
    })
    .eq('id', serviceId)
    .eq('coach_id', coachId)
    .select('id, name, description, price_label, payment_link, tos_url, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { serviceId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  if (!(await checkServiceTier(coachId))) {
    return Response.json({ error: 'Services require Coach Pro or Business plan' }, { status: 403 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('coach_services')
    .delete()
    .eq('id', serviceId)
    .eq('coach_id', coachId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
