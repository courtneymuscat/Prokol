import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ formId: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { formId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { data: form } = await supabase.from('forms').select('id').eq('id', formId).eq('coach_id', coachId).single()
  if (!form) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Get next order_index
  const { data: last } = await supabase
    .from('form_questions')
    .select('order_index')
    .eq('form_id', formId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const order_index = (last?.order_index ?? -1) + 1

  const { data, error } = await supabase
    .from('form_questions')
    .insert({
      form_id: formId,
      order_index,
      label: body.label ?? 'New question',
      description: body.description ?? null,
      type: body.type ?? 'text',
      options: body.options ?? null,
      required: body.required ?? false,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
