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

  const expanded = req.nextUrl.searchParams.get('expanded') === '1'
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))

  const supabase = await createClient()

  if (expanded) {
    // Expanded mode: fetch more OFF results for the full search modal
    const offResults = await fetchOpenFoodFacts(q, 30, page)
    return Response.json({ results: offResults, hasMore: offResults.length === 30 })
  }

  // Standard dropdown: local DB + first page of OFF in parallel
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
    fetchOpenFoodFacts(q, 8, 1),
  ])

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

  const localNames = new Set(merged.map((f) => f.name.toLowerCase()))
  for (const food of offResults) {
    if (merged.length >= 15) break
    if (!localNames.has(food.name.toLowerCase())) merged.push(food)
  }

  return Response.json(merged)
}

async function fetchOpenFoodFacts(q: string, pageSize = 8, page = 1): Promise<FoodRow[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)

  try {
    // Legacy search endpoint — correctly filters by product name and brand
    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
    url.searchParams.set('search_terms', q)
    url.searchParams.set('json', '1')
    url.searchParams.set('fields', 'product_name,product_name_en,brands,nutriments')
    url.searchParams.set('page_size', String(pageSize))
    url.searchParams.set('page', String(page))
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
