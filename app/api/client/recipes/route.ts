import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/client/recipes — the client's own coach's recipe library, for
// picking a replacement when swapping a recipe inside a meal plan. Recipes
// aren't org-shared (see lib/recipeServes.ts's comment on why food-serves
// is org-shared but recipes follow coach_id directly) — a client only ever
// has one active coach relationship, so there's no ambiguity to resolve.
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()

  const { data: rel } = await admin
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', session.user.id)
    .eq('status', 'active')
    .single()

  if (!rel) return Response.json([])

  const { data } = await admin
    .from('recipes')
    .select('id, name, category, image_url, total_calories, total_protein, total_carbs, total_fat')
    .eq('coach_id', rel.coach_id)
    .is('archived_at', null)
    .order('name', { ascending: true })

  return Response.json(data ?? [])
}
