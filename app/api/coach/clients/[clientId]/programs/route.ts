import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

async function verifyCoachClientRelationship(coachId: string, clientId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()
  return !!data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyCoachClientRelationship(coachId, clientId))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_programs')
    .select('id, program_id, name, content, start_date, status, created_at, updated_at')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await verifyCoachClientRelationship(coachId, clientId))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { program_id, name: directName, content: directContent, start_date } = body as {
    program_id?: string | null
    name?: string
    content?: unknown
    start_date?: string
  }

  const supabase = await createClient()

  let insertName: string
  let insertContent: unknown

  if (program_id) {
    // Fetch the source program to snapshot name + content
    const { data: program, error: progError } = await supabase
      .from('programs')
      .select('name, content')
      .eq('id', program_id)
      .eq('coach_id', coachId)
      .single()

    if (progError || !program) {
      return Response.json({ error: 'Program not found' }, { status: 404 })
    }
    insertName = program.name
    insertContent = program.content
  } else {
    // Direct creation — name and content provided in body
    if (!directName?.trim()) {
      return Response.json({ error: 'name is required when program_id is not provided' }, { status: 400 })
    }
    insertName = directName.trim()
    insertContent = directContent ?? []
  }

  const { data, error } = await supabase
    .from('client_programs')
    .insert({
      program_id: program_id ?? null,
      client_id: clientId,
      coach_id: coachId,
      name: insertName,
      content: insertContent,
      start_date: start_date ?? new Date().toISOString().slice(0, 10),
      status: 'active',
    })
    .select('id, program_id, name, content, start_date, status, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
