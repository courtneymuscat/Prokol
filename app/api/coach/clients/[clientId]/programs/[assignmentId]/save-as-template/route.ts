import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'

type Ctx = { params: Promise<{ clientId: string; assignmentId: string }> }

export async function POST(
  _req: Request,
  { params }: Ctx
) {
  const { clientId, assignmentId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Verify the coach owns this client_programs record
  const { data: prog, error: fetchError } = await supabase
    .from('client_programs')
    .select('id, name, content, coach_id')
    .eq('id', assignmentId)
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  if (fetchError || !prog) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Insert into the programs template table
  const { data: template, error: insertError } = await supabase
    .from('programs')
    .insert({
      coach_id: coachId,
      name: prog.name,
      description: null,
      content: prog.content,
    })
    .select('id')
    .single()

  if (insertError || !template) {
    return Response.json({ error: insertError?.message ?? 'Failed to create template' }, { status: 500 })
  }

  return Response.json({ id: template.id })
}
