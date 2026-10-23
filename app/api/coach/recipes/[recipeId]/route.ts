import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import { getCoachServeMap, computeServeCount, aggregateServeTotals } from '@/lib/recipeServes'
import type { NextRequest } from 'next/server'

type IngredientInput = {
  food_id?: string | null
  food_name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('id, name, category, instructions, image_url, total_calories, total_protein, total_carbs, total_fat, archived_at')
    .eq('id', recipeId)
    .eq('coach_id', coachId)
    .single()

  if (error || !recipe) return Response.json({ error: 'Not found' }, { status: 404 })

  const [{ data: ingredients }, { data: modifications }, serveMap] = await Promise.all([
    supabase
      .from('recipe_ingredients')
      .select('id, food_id, food_name, grams, calories, protein, carbs, fat, sort_order')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('recipe_modifications')
      .select('id, tag, note, sort_order')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true }),
    getCoachServeMap(coachId),
  ])

  const ingredientsWithServes = (ingredients ?? []).map((i) => ({
    ...i,
    serve_count: computeServeCount(i, serveMap[i.food_name.toLowerCase()]),
  }))
  const serveTotals = aggregateServeTotals(ingredients ?? [], serveMap)

  return Response.json({ ...recipe, ingredients: ingredientsWithServes, modifications: modifications ?? [], serve_totals: serveTotals })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', recipeId)
    .eq('coach_id', coachId)
    .single()
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, category, instructions, image_url } = body as {
    name?: string
    category?: string | null
    instructions?: string | null
    image_url?: string | null
  }
  const ingredients = (body.ingredients ?? []) as IngredientInput[]
  const modifications = (body.modifications ?? []) as ModificationInput[]

  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
  if (!ingredients.length) return Response.json({ error: 'At least one ingredient required' }, { status: 400 })

  const totals = sumTotals(ingredients)

  const { error: updateError } = await supabase
    .from('recipes')
    .update({
      name: name.trim(),
      category: category || null,
      instructions: instructions || null,
      image_url: image_url || null,
      ...totals,
    })
    .eq('id', recipeId)
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  // Full replace, matching the existing meal-plan content-replacement
  // convention rather than diffing individual ingredient rows.
  await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
  const { error: ingredientsError } = await supabase.from('recipe_ingredients').insert(
    ingredients.map((i, idx) => ({
      recipe_id: recipeId,
      food_id: i.food_id || null,
      food_name: i.food_name,
      grams: i.grams,
      calories: i.calories,
      protein: i.protein,
      carbs: i.carbs,
      fat: i.fat,
      sort_order: idx,
    })),
  )
  if (ingredientsError) return Response.json({ error: ingredientsError.message }, { status: 500 })

  await supabase.from('recipe_modifications').delete().eq('recipe_id', recipeId)
  if (modifications.length) {
    const { error: modsError } = await supabase.from('recipe_modifications').insert(
      modifications.map((m, idx) => ({
        recipe_id: recipeId,
        tag: m.tag,
        note: m.note,
        sort_order: idx,
      })),
    )
    if (modsError) return Response.json({ error: modsError.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}

// Archives rather than hard-deletes — matches the autoflow-template
// archive-instead-of-delete convention, keeping a coach's recipe history
// intact (and any meal plan already referencing it still resolves).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recipes')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', recipeId)
    .eq('coach_id', coachId)
    .select('id')
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
