import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

// POST  { table, id, restore?: boolean }  →  set/clear archived_at
//
// Soft-delete + restore for the four coach template types. Keeps every
// existing client_* assignment, response, submission, schedule, and
// history row intact — only the template's visibility in the coach's
// library is affected.

type TemplateTable = 'programs' | 'meal_plans' | 'autoflow_templates' | 'forms'
const VALID: TemplateTable[] = ['programs', 'meal_plans', 'autoflow_templates', 'forms']

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { table?: string; id?: string; restore?: boolean }
  const table = body.table as TemplateTable | undefined
  const id = body.id
  if (!table || !VALID.includes(table) || !id) {
    return Response.json({ error: 'table + id required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Only the coach who owns the row can archive it. Org templates the
  // coach didn't create cannot be archived from another coach's account
  // — they must clone or ask the publisher to archive.
  const { data, error } = await supabase
    .from(table)
    .update({ archived_at: body.restore ? null : new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', coachId)
    .select('id, archived_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
