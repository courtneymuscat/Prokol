import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

type FoodRow = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  unit?: string
  custom?: boolean
  source?: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return Response.json([])

  const supabase = await createClient()

  // Run local DB + Open Food Facts search in parallel
  const [
    { data: dbStarts },
    { data: dbContains },
    { data: customFoods },
    offResults,
  ] = await Promise.all([
    supabase
      .from('food_database')
      .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit')
      .ilike('name', `${q}%`)
      .order('name')
      .limit(8),
    supabase
      .from('food_database')
      .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit')
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(12),
    supabase
      .from('foods')
      .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit')
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(5),
    fetchOpenFoodFacts(q),
  ])

  // Merge: personal foods → local starts-with → local contains → OFF
  // Deduplicate by id, cap at 15 results
  const custom = (customFoods ?? []).map((f) => ({ ...f, custom: true }))
  const seen = new Set<string>()
  const merged: FoodRow[] = []

  for (const food of [...custom, ...(dbStarts ?? []), ...(dbContains ?? [])]) {
    const key = String(food.id)
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(food as FoodRow)
    }
  }

  // Fill remaining slots with OFF results not already in local DB by name
  const localNames = new Set(merged.map((f) => f.name.toLowerCase()))
  for (const food of offResults) {
    if (merged.length >= 15) break
    if (!localNames.has(food.name.toLowerCase())) {
      merged.push(food)
    }
  }

  return Response.json(merged)
}

async function fetchOpenFoodFacts(q: string): Promise<FoodRow[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)

  try {
    // Use v2 search API — searches product name AND brand fields
    const url = new URL('https://world.openfoodfacts.org/api/v2/search')
    url.searchParams.set('search_terms', q)
    url.searchParams.set('fields', 'product_name,product_name_en,brands,nutriments')
    url.searchParams.set('page_size', '10')
    url.searchParams.set('sort_by', 'unique_scans_n')

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'NutriCoach/1.0 (nutricoach.app)' },
      signal: controller.signal,
    })

    if (!res.ok) return []
    const data = await res.json()

    const results: FoodRow[] = []
    for (const p of (data.products ?? [])) {
      // Build a display name: "Brand — Product Name" when brand is known
      const base = (p.product_name_en || p.product_name || '').trim()
      if (!base) continue
      const brand = (p.brands ?? '').split(',')[0].trim()
      const name = brand && !base.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} — ${base}`
        : base

      const n = p.nutriments ?? {}
      const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null)
      if (kcal == null) continue

      results.push({
        id: `off:${encodeURIComponent(name)}`,
        name,
        calories_per_100g: Math.round(kcal),
        protein_per_100g: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
        carbs_per_100g: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
        fat_per_100g: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
        source: 'off',
      })
    }
    return results
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
