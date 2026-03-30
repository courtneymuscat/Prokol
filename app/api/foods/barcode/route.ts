import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code) return Response.json(null)

  const supabase = await createClient()

  // 1. Check local shared database first
  const { data: local } = await supabase
    .from('food_database')
    .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
    .eq('barcode', code)
    .maybeSingle()

  if (local) return Response.json(local)

  // 2. Look up Open Food Facts (free, no API key required)
  try {
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      { headers: { 'User-Agent': 'NutriCoach/1.0 (nutricoach.app)' } }
    )

    if (offRes.ok) {
      const offData = await offRes.json()

      if (offData.status === 1 && offData.product) {
        const p = offData.product
        const n = p.nutriments ?? {}

        // Prefer English name, fall back to generic product name
        const name = (p.product_name_en || p.product_name || '').trim()
        if (!name) return Response.json(null)

        // energy-kcal_100g is kcal directly; energy_100g is kJ — convert if needed
        const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0)

        const food = {
          name,
          calories_per_100g: Math.round(kcal),
          protein_per_100g: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
          carbs_per_100g: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
          fat_per_100g: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
          barcode: code,
        }

        // Auto-save to shared database so future scans are instant
        const { data: saved } = await supabase
          .from('food_database')
          .insert(food)
          .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
          .single()

        if (saved) return Response.json(saved)

        // Insert failed (e.g. duplicate race) — return data without id
        return Response.json({ id: code, ...food })
      }
    }
  } catch {
    // Open Food Facts unreachable — fall through to null
  }

  return Response.json(null)
}
