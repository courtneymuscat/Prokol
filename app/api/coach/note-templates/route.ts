import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { fetchOrgTemplatesForCoach } from '@/lib/org'
import type { NextRequest } from 'next/server'

type NoteTemplateRow = {
  id: string
  name: string
  body: string
  created_at: string
}

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const [{ data: own }, orgItems] = await Promise.all([
    supabase
      .from('note_templates')
      .select('id, name, body, created_at')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: true }),
    fetchOrgTemplatesForCoach<NoteTemplateRow>(
      coachId,
      'note_templates',
      'id, name, body, created_at',
    ),
  ])

  const merged = [
    ...orgItems.map((t) => ({ ...t, is_org_template: true })),
    ...((own as NoteTemplateRow[] | null) ?? []).map((t) => ({ ...t, is_org_template: false })),
  ]
  return Response.json(merged)
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, body } = await req.json()
  if (!name?.trim() || !body?.trim()) {
    return Response.json({ error: 'Name and body are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('note_templates')
    .insert({ coach_id: coachId, name: name.trim(), body: body.trim() })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
