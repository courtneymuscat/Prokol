import { requireCoach } from '@/lib/coach'
import { getOrgForUser, fetchMasterTemplatesForCoach } from '@/lib/org'

// GET /api/coach/master-templates
//
// Name + step-count only, for the client-assignment picker. Deliberately
// not a general "browse the library" endpoint — there is no detail/editor
// route for these ids, by design. Default-off: only templates this specific
// coach has been explicitly granted access to (see lib/org.ts
// fetchMasterTemplatesForCoach / master_template_coach_access) show up here.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const membership = await getOrgForUser(coachId)
  if (!membership) return Response.json([])

  const templates = await fetchMasterTemplatesForCoach(membership.org_id, coachId)
  return Response.json(templates)
}
