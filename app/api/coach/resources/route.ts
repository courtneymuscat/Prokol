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
  const [{ data: own }, orgItems, { data: globalItems }] = await Promise.all([
    supabase
      .from('coach_resources')
      .select('*, coach_resource_folders(id, name, color, icon)')
      .eq('coach_id', coachId)
      .eq('is_org_template', false)
      .order('created_at', { ascending: false }),
    fetchOrgTemplatesForCoach<ResourceRow>(
      coachId,
      'coach_resources',
      'id, coach_id, folder_id, name, description, type, url, created_at',
    ),
    // Platform-wide resources (e.g. the Prokol app-overview video) — visible
    // to every coach regardless of org membership, via the is_global RLS
    // widening. Excludes the coach's own rows so Court herself doesn't see
    // her global resources listed twice.
    supabase
      .from('coach_resources')
      .select('id, coach_id, folder_id, name, description, type, url, created_at')
      .eq('is_global', true)
      .neq('coach_id', coachId)
      .order('created_at', { ascending: false }),
  ])

  // Org resources don't have the coach's folder relation — flatten and tag
  // them so the UI can render an "Organisation resources" group. Dedupe by
  // id so the coach-publisher case (where the same row exists in both
  // 'own' and orgItems) doesn't render twice. Prefer the org-template
  // entry to preserve the badge.
  const byId = new Map<string, Record<string, unknown> & { id: string; is_org_template: boolean; is_global?: boolean }>()
  for (const r of (own as ResourceRow[] | null) ?? []) {
    byId.set(r.id, { ...r, is_org_template: false })
  }
  for (const r of orgItems) {
    byId.set(r.id, { ...r, is_org_template: true, coach_resource_folders: null })
  }
  for (const r of (globalItems as ResourceRow[] | null) ?? []) {
    byId.set(r.id, { ...r, is_org_template: false, is_global: true, coach_resource_folders: null })
  }
  return Response.json(Array.from(byId.values()))
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
