import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/coach'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: allTags }, { data: assignments }] = await Promise.all([
    admin
      .from('client_tags')
      .select('id, name, color, created_at')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: true }),
    admin
      .from('client_tag_assignments')
      .select('client_id, client_tags(id, name, color)')
      .eq('coach_id', coachId),
  ])

  const byClient: Record<string, { id: string; name: string; color: string }[]> = {}
  for (const row of assignments ?? []) {
    const tag = row.client_tags as unknown as { id: string; name: string; color: string } | null
    if (!tag) continue
    if (!byClient[row.client_id]) byClient[row.client_id] = []
    byClient[row.client_id].push(tag)
  }

  return NextResponse.json({ allTags: allTags ?? [], byClient })
}
