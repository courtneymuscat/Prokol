import { requireCoach } from '@/lib/coach'
import { getCoachServeMap } from '@/lib/recipeServes'

// Lets the recipe editor recompute serve counts live as ingredients are
// added/removed, without a round-trip per keystroke — fetched once per
// editor session and reused with the pure computeServeCount/
// aggregateServeTotals helpers client-side.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const map = await getCoachServeMap(coachId)
  return Response.json(map)
}
