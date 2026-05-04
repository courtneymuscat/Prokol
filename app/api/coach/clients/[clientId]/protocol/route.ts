import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('client_protocol')
    .select('sections, updated_at')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .maybeSingle()

  return Response.json({ sections: data?.sections ?? [] })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { sections } = await req.json()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_protocol')
    .upsert(
      { client_id: clientId, coach_id: coachId, sections: sections ?? [], updated_at: new Date().toISOString() },
      { onConflict: 'client_id,coach_id' }
    )
    .select('sections')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ sections: data.sections })
}
