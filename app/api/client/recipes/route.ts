import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubscription } from '@/lib/subscription'
import { FEATURES } from '@/lib/features'

// GET /api/client/recipes — the client's own coach's recipe library, plus
// (gated behind FEATURES.PLATFORM_RECIPE_LIBRARY) Court's platform-wide
// shared recipes. Coached clients always get the platform recipes for free
// — getSubscription() forces their tier to 'coached', which already
// includes this feature — individual users need Optimiser+ to see them.
// Recipes aren't org-shared otherwise (see lib/recipeServes.ts's comment on
// why food-serves is org-shared but recipes follow coach_id directly) — a
// client only ever has one active coach relationship, so there's no
// per-coach ambiguity to resolve.
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()
  const sub = await getSubscription()
  const canAccessLibrary = sub.canAccess(FEATURES.PLATFORM_RECIPE_LIBRARY)

  const { data: rel } = await admin
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', session.user.id)
    .eq('status', 'active')
    .single()

  if (!canAccessLibrary && !rel) return Response.json([])

  const cols = 'id, name, category, image_url, total_calories, total_protein, total_carbs, total_fat, diet_tags, tier_tag'
  const base = admin.from('recipes').select(cols)
  const filtered = rel && canAccessLibrary
    ? base.or(`coach_id.eq.${rel.coach_id},is_global.eq.true`)
    : rel
      ? base.eq('coach_id', rel.coach_id)
      : base.eq('is_global', true)

  const { data } = await filtered.is('archived_at', null).order('name', { ascending: true })
  return Response.json(data ?? [])
}
