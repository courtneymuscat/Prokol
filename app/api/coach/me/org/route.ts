import { requireCoach } from '@/lib/coach'
import { getOrgForUser } from '@/lib/org'

// GET /api/coach/me/org — returns the calling coach's org membership snapshot
// for use in list pages that need role-aware subtitles. Returns null fields if
// the coach isn't in an org.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const membership = await getOrgForUser(coachId)
  return Response.json({
    org_id: membership?.org_id ?? null,
    org_name: membership?.org_name ?? null,
    org_role: membership?.role ?? null,
  })
}
