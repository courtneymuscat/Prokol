import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { getOrgForUser } from '@/lib/org'
import type { NextRequest } from 'next/server'

type IngredientInput = {
  food_id?: string | null
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  link?: string | null
}

type ModificationInput = {
  tag: string
  note: string
}

function sumTotals(ingredients: IngredientInput[]) {
  return ingredients.reduce(
    (acc, i) => ({
      total_calories: acc.total_calories + (i.calories || 0),
      total_protein: acc.total_protein + (i.protein || 0),
      total_carbs: acc.total_carbs + (i.carbs || 0),
      total_fat: acc.total_fat + (i.fat || 0),
    }),
    { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 },
  )
}

export async function GET(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const includeArchived = searchParams.get('archived') === 'true'

  // Unlike coach_clients/conversations (real client relationships, which
  // must stay siloed per gym), a recipe is authored content the coach owns
  // — it should follow coach_id everywhere, the same way meal_plans/
  // autoflow_templates/programs templates already do (see their own list
  // routes: all filter by coach_id only, no org_id). Scoping this by the
  // currently-active org would hide a coach's own recipes every time they
  // switch which gym they're acting as, which is the opposite of what's
  // wanted for a personal content library.
  let query = supabase
    .from('recipes')
    .select('id, name, category, image_url, total_calories, total_protein, total_carbs, total_fat, diet_tags, tier_tag, archived_at, created_at')
    .eq('coach_id', coachId)
  if (category) query = query.eq('category', category)
  if (!includeArchived) query = query.is('archived_at', null)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { name, category, instructions, image_url, diet_tags, tier_tag } = body as {
    name?: string
    category?: string | null
    instructions?: string | null
    image_url?: string | null
    diet_tags?: string[]
    tier_tag?: string | null
  }
  const ingredients = (body.ingredients ?? []) as IngredientInput[]
  const modifications = (body.modifications ?? []) as ModificationInput[]

  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
  if (!ingredients.length) return Response.json({ error: 'At least one ingredient required' }, { status: 400 })

  const supabase = await createClient()
  const membership = await getOrgForUser(coachId)
  const totals = sumTotals(ingredients)

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      coach_id: coachId,
      org_id: membership?.org_id ?? null,
      name: name.trim(),
      category: category || null,
      instructions: instructions || null,
      image_url: image_url || null,
      diet_tags: diet_tags ?? [],
      tier_tag: tier_tag || null,
      ...totals,
    })
    .select('id')
    .single()

  if (recipeError || !recipe) return Response.json({ error: recipeError?.message ?? 'Failed to create recipe' }, { status: 500 })

  const { error: ingredientsError } = await supabase.from('recipe_ingredients').insert(
    ingredients.map((i, idx) => ({
      recipe_id: recipe.id,
      food_id: i.food_id || null,
      food_name: i.food_name,
      grams: i.grams,
      calories: i.calories,
      protein: i.protein,
      carbs: i.carbs,
      fat: i.fat,
      link: i.link || null,
      sort_order: idx,
    })),
  )

  if (ingredientsError) {
    // Roll back the orphaned recipe row rather than leaving an empty shell.
    await supabase.from('recipes').delete().eq('id', recipe.id)
    return Response.json({ error: ingredientsError.message }, { status: 500 })
  }

  if (modifications.length) {
    const { error: modsError } = await supabase.from('recipe_modifications').insert(
      modifications.map((m, idx) => ({
        recipe_id: recipe.id,
        tag: m.tag,
        note: m.note,
        sort_order: idx,
      })),
    )
    if (modsError) return Response.json({ error: modsError.message }, { status: 500 })
  }

  return Response.json({ id: recipe.id })
}
