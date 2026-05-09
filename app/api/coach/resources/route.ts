import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { fetchOrgTemplatesForCoach } from '@/lib/org'
import type { NextRequest } from 'next/server'

type ResourceRow = {
  id: string
  coach_id: string
  folder_id: string | null
  name: string
  description: string | null
  type: string
  url: string | null
  created_at: string
}

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  const [{ data: own }, orgItems] = await Promise.all([
    supabase
      .from('coach_resources')
      .select('*, coach_resource_folders(id, name, color, icon)')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false }),
    fetchOrgTemplatesForCoach<ResourceRow>(
      coachId,
      'coach_resources',
      'id, coach_id, folder_id, name, description, type, url, created_at',
    ),
  ])

  // Org resources don't have the coach's folder relation — flatten and tag
  // them so the UI can render an "Organisation resources" group.
  const merged = [
    ...orgItems.map((r) => ({ ...r, is_org_template: true, coach_resource_folders: null })),
    ...((own as ResourceRow[] | null) ?? []).map((r) => ({ ...r, is_org_template: false })),
  ]
  return Response.json(merged)
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, description, type, url, folder_id } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_resources')
    .insert({
      coach_id: coachId,
      name: name.trim(),
      description: description ?? null,
      type: type ?? 'link',
      url: url ?? null,
      folder_id: folder_id ?? null,
    })
    .select('*, coach_resource_folders(id, name, color, icon)')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
