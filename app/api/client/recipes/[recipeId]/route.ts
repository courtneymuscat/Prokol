import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

// GET /api/client/recipes/[recipeId] — full detail (ingredients +
// modification notes) for the swap-recipe picker and the read-only
// modification-notes reference panel. Ownership verified against the
// client's own active coach, not just "any recipe exists with this id".
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params
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
  if (!rel) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: recipe, error } = await admin
    .from('recipes')
    .select('id, name, category, instructions, total_calories, total_protein, total_carbs, total_fat, diet_tags, tier_tag')
    .eq('id', recipeId)
    .eq('coach_id', rel.coach_id)
    .single()
  if (error || !recipe) return Response.json({ error: 'Not found' }, { status: 404 })

  const [{ data: ingredients }, { data: modifications }] = await Promise.all([
    admin
      .from('recipe_ingredients')
      .select('food_id, food_name, grams, calories, protein, carbs, fat, link, sort_order')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true }),
    admin
      .from('recipe_modifications')
      .select('tag, note, sort_order')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true }),
  ])

  return Response.json({ ...recipe, ingredients: ingredients ?? [], modifications: modifications ?? [] })
}
