import { requirePlatformAdmin } from '@/lib/admin'
import { listOrgLeads, createOrgLead } from '@/lib/org'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  await requirePlatformAdmin()
  const { orgId } = await params

  const leads = await listOrgLeads(orgId)
  return Response.json({ leads })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const admin = await requirePlatformAdmin()
  const { orgId } = await params

  const body = await req.json()
  if (!body?.name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 })

  const result = await createOrgLead(orgId, admin.id, body)
  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ lead: result.lead })
}
