import { requirePlatformAdmin } from '@/lib/admin'
import { updateOrgLead, deleteOrgLead } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> }
) {
  await requirePlatformAdmin()
  const { orgId, id } = await params
  const body = await req.json()

  const result = await updateOrgLead(orgId, id, body)
  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ lead: result.lead })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> }
) {
  await requirePlatformAdmin()
  const { orgId, id } = await params

  const result = await deleteOrgLead(orgId, id)
  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ ok: true })
}
