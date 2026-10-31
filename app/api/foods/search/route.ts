import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

// This route only searches the local database.
// Open Food Facts is called directly from the browser (see FoodSearch.tsx)
// to avoid server-side rate limiting.

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return Response.json([])

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // For multi-word queries (e.g. "chicken raw"), search each word individually
  // so "Chicken, raw breast" is found even though "chicken raw" isn't a substring.
  const terms = q.split(/\s+/).filter(t => t.length >= 2)

  // Build queries that require ALL terms to be present in the name.
  // Each .ilike() call adds an AND condition in Supabase.
  function applyTerms(base: ReturnType<typeof supabase.from>) {
    let query = base.select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit, serving_quantity, serving_size')
    for (const t of terms) query = query.ilike('name', `%${t}%`)
    return query
  }

  // `foods` RLS allows any authenticated user to read any row (plain
  // custom foods are treated as a shared low-risk reference list), but a
  // food mirrored from someone's own named recipe (see
  // lib/clientRecipeFoodSync.ts) is more personally identifying — scope
  // those specifically to their owner rather than inheriting that global
  // visibility. Plain custom foods (source_client_recipe_id null) keep
  // today's existing behaviour unchanged.
  function applyRecipeFoodScope(query: ReturnType<typeof applyTerms>) {
    return session
      ? query.or(`source_client_recipe_id.is.null,user_id.eq.${session.user.id}`)
      : query.is('source_client_recipe_id', null)
  }

  const [
    { data: dbStarts },
    { data: dbContains },
    { data: customFoods },
  ] = await Promise.all([
    applyTerms(supabase.from('food_database')).ilike('name', `${terms[0]}%`).order('name').limit(20),
    applyTerms(supabase.from('food_database')).order('name').limit(30),
    applyRecipeFoodScope(applyTerms(supabase.from('foods'))).order('name').limit(10),
  ])

  // Score each DB result by how many query terms appear in the name,
  // then sort so all-terms matches come first.
  function scoreLocal(name: string): number {
    const n = name.toLowerCase()
    let s = 0
    for (const t of terms) if (n.includes(t.toLowerCase())) s++
    return s
  }

  const custom = (customFoods ?? []).map((f) => ({ ...f, custom: true }))
  const seen = new Set<string>()
  const merged: typeof custom = []
  for (const food of [...custom, ...(dbStarts ?? []), ...(dbContains ?? [])]) {
    const key = String(food.id)
    if (!seen.has(key)) { seen.add(key); merged.push(food as typeof custom[0]) }
  }

  merged.sort((a, b) => scoreLocal(b.name) - scoreLocal(a.name))

  return Response.json(merged.slice(0, 15))
}
