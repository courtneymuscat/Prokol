import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json([])

  const { data } = await supabase
    .from('user_food_history')
    .select('food_id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit, serving_quantity, serving_size, logged_at')
    .eq('user_id', session.user.id)
    .order('logged_at', { ascending: false })
    .limit(40)

  // Deduplicate by food_id (or name), keep most recent occurrence. Drop:
  //   1. Zero-macro entries (Open Food Facts placeholders).
  //   2. Implausible entries — macros > 100g/100g of food, or stated
  //      calories wildly inconsistent with 4·P + 4·C + 9·F (>50% drift
  //      over 50 kcal). These are junk that snuck into history once and
  //      would clutter the dropdown forever.
  const seen = new Set<string>()
  const unique = (data ?? []).filter((item) => {
    const key = item.food_id ?? item.name
    if (seen.has(key)) return false
    seen.add(key)
    const c = item.calories_per_100g ?? 0
    const p = item.protein_per_100g ?? 0
    const cb = item.carbs_per_100g ?? 0
    const ft = item.fat_per_100g ?? 0
    if (c === 0 && p === 0 && cb === 0 && ft === 0) return false
    if (p + cb + ft > 105) return false
    const computed = p * 4 + cb * 4 + ft * 9
    if (c > 0 && computed > 0) {
      const drift = Math.abs(c - computed) / Math.max(c, computed)
      if (drift > 0.5 && Math.abs(c - computed) > 50) return false
    }
    return true
  }).slice(0, 10)

  // Map to FoodResult shape (id instead of food_id)
  const result = unique.map(({ food_id, logged_at, ...rest }) => ({ id: food_id ?? '', ...rest }))

  return Response.json(result)
}
