import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unpublishMasterTemplate } from '@/lib/org'
import { isGymPartnershipsEnabled } from '@/lib/flags'

// DELETE /api/admin/master-templates/publications/[id]
// Unpublishes a master template from a gym/org. Platform-admin only — this
// mirrors the create-side restriction in POST .../publications/route.ts;
// RLS on master_template_publications enforces the same rule at the DB
// layer as defense-in-depth.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isGymPartnershipsEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await unpublishMasterTemplate(session.user.id, id)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Forbidden' ? 403 : 400 })
  }
  return NextResponse.json({ ok: true })
}
