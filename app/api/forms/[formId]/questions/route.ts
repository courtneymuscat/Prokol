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

// Batch upsert: replaces all questions for a form in one round-trip
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { formId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { data: form } = await supabase.from('forms').select('id').eq('id', formId).eq('coach_id', coachId).single()
  if (!form) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { questions } = await req.json()
  if (!Array.isArray(questions)) return Response.json({ error: 'questions must be an array' }, { status: 400 })

  type Q = { id?: string | null; label: string; description?: string | null; type: string; options?: unknown[] | null; required?: boolean; order_index: number }

  const toUpsert: Record<string, unknown>[] = []
  const toInsert: Record<string, unknown>[] = []

  for (const q of questions as Q[]) {
    const row = {
      form_id: formId,
      label: q.label ?? '',
      description: q.description ?? null,
      type: q.type ?? 'text',
      options: q.options ?? null,
      required: q.required ?? false,
      order_index: q.order_index,
    }
    if (q.id) {
      toUpsert.push({ ...row, id: q.id })
    } else {
      toInsert.push(row)
    }
  }

  const keptIds = (questions as Q[]).filter(q => q.id).map(q => q.id as string)

  // Run upsert, insert, and delete in parallel
  const [upsertResult, insertResult, deleteResult] = await Promise.all([
    toUpsert.length > 0
      ? supabase.from('form_questions').upsert(toUpsert, { onConflict: 'id' }).select('id, order_index')
      : Promise.resolve({ data: [], error: null }),
    toInsert.length > 0
      ? supabase.from('form_questions').insert(toInsert).select('id, order_index')
      : Promise.resolve({ data: [], error: null }),
    // Delete any questions removed from the form
    keptIds.length > 0
      ? supabase.from('form_questions').delete().eq('form_id', formId).not('id', 'in', `(${keptIds.join(',')})`)
      : supabase.from('form_questions').delete().eq('form_id', formId),
  ])

  const err = upsertResult.error ?? insertResult.error ?? deleteResult.error
  if (err) return Response.json({ error: err.message }, { status: 500 })

  // Return all saved questions with their IDs so the client can reconcile
  const saved = [...(upsertResult.data ?? []), ...(insertResult.data ?? [])]
  return Response.json({ ok: true, saved })
}
