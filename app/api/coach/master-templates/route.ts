import { requireCoach } from '@/lib/coach'
import { getOrgForUser, fetchMasterTemplatesForOrg } from '@/lib/org'

// GET /api/coach/master-templates
//
// Name + step-count only, for the client-assignment picker. Deliberately
// not a general "browse the library" endpoint — there is no detail/editor
// route for these ids, by design (see lib/org.ts fetchMasterTemplatesForOrg).
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const membership = await getOrgForUser(coachId)
  if (!membership) return Response.json([])

  const templates = await fetchMasterTemplatesForOrg(membership.org_id)
  return Response.json(templates)
}
