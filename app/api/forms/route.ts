import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { fetchOrgTemplatesForCoach } from '@/lib/org'
import type { NextRequest } from 'next/server'

type FormRow = {
  id: string
  title: string
  description: string | null
  type: string | null
  is_active: boolean | null
  created_at: string
}

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const [{ data: own }, orgItems] = await Promise.all([
    supabase
      .from('forms')
      .select('id, title, description, type, is_active, created_at')
      .eq('coach_id', coachId)
      .eq('is_client_copy', false)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    fetchOrgTemplatesForCoach<FormRow>(
      coachId,
      'forms',
      'id, title, description, type, is_active, created_at',
    ),
  ])

  // Dedupe by id: if the coach is the publisher of an org template they
  // also own the underlying row, so it appears in both 'own' and orgItems
  // — which produces duplicates in dropdowns (e.g. check-in form picker).
  // Prefer the org-template entry so the UI keeps its 'Published' badge.
  const byId = new Map<string, FormRow & { is_org_template: boolean }>()
  for (const t of (own as FormRow[] | null) ?? []) {
    byId.set(t.id, { ...t, is_org_template: false })
  }
  for (const t of orgItems) {
    byId.set(t.id, { ...t, is_org_template: true })
  }
  return Response.json(Array.from(byId.values()))
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { title, description, type } = await req.json()
  if (!title) return Response.json({ error: 'Title required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('forms')
    .insert({ coach_id: coachId, title, description: description ?? null, type: type ?? 'weekly_checkin' })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
