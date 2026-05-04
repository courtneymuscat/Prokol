import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

// Build normalised code variants to maximise lookup hits:
// handles UPC-A ↔ EAN-13 padding, and minor scanner inconsistencies
function codeVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, '')
  const variants = new Set<string>([digits, raw.trim()])
  if (digits.length === 12) variants.add('0' + digits)         // UPC-A → EAN-13
  if (digits.length === 13 && digits.startsWith('0')) variants.add(digits.slice(1)) // EAN-13 → UPC-A
  return [...variants].filter(v => v.length >= 8)
}

async function fetchOFF(code: string, host = 'world.openfoodfacts.org') {
  const res = await fetch(
    `https://${host}/api/v2/product/${encodeURIComponent(code)}.json`,
    { headers: { 'User-Agent': 'Prokol/1.0 (prokol.io)' }, signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  const p = data.product
  const n = p.nutriments ?? {}
  const name = (p.product_name_en || p.product_name || '').trim()
  if (!name) return null
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0)
  function parseGrams(val: unknown): number | null {
    if (!val) return null
    const n = parseFloat(String(val).replace(/[^0-9.]/g, ''))
    return n > 0 && n < 2000 ? n : null
  }
  const servingSize = (p.serving_size as string | undefined)?.trim() ?? null
  const quantityStr = p.quantity as string | undefined
  const parsedQuantity = quantityStr ? parseGrams(quantityStr.match(/(\d+(?:\.\d+)?)\s*g\b/i)?.[1]) : null
  const rawServingQty = parseGrams(p.serving_quantity)
  const rawProductQty = parseGrams(p.product_quantity) ?? parsedQuantity
  const servingQty = rawServingQty ?? (rawProductQty && rawProductQty <= 1500 ? rawProductQty : null)
  const servingLabel = servingSize ?? (servingQty && rawServingQty !== servingQty ? `${servingQty}g` : null)
  const imageUrl = (p.image_front_small_url || p.image_front_url || p.image_url || null) as string | null
  return {
    name,
    calories_per_100g: Math.round(kcal),
    protein_per_100g:  Math.round((n['proteins_100g']       ?? 0) * 10) / 10,
    carbs_per_100g:    Math.round((n['carbohydrates_100g']   ?? 0) * 10) / 10,
    fat_per_100g:      Math.round((n['fat_100g']             ?? 0) * 10) / 10,
    barcode: code,
    ...(servingQty ? { serving_quantity: servingQty } : {}),
    ...(servingLabel ? { serving_size: servingLabel } : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}),
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code) return Response.json(null)

  const supabase = await createClient()
  const variants = codeVariants(code)

  // 1. Check local shared DB — try all variants
  for (const v of variants) {
    const { data: local } = await supabase
      .from('food_database')
      .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
      .eq('barcode', v)
      .maybeSingle()
    if (local) return Response.json(local)
  }

  async function saveAndReturn(food: ReturnType<typeof fetchOFF> extends Promise<infer T> ? T : never) {
    if (!food) return null
    const { data: saved } = await supabase
      .from('food_database')
      .insert(food)
      .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
      .single()
    return saved ?? { id: code, ...food }
  }

  // 2. Try Open Food Facts (world + AU) — all variants in parallel
  try {
    const queries = variants.flatMap(v => [fetchOFF(v, 'world.openfoodfacts.org'), fetchOFF(v, 'au.openfoodfacts.org')])
    const results = await Promise.allSettled(queries)
    const hit = results.find(r => r.status === 'fulfilled' && r.value)
    const food = hit?.status === 'fulfilled' ? hit.value : null
    if (food) return Response.json(await saveAndReturn(food))
  } catch { /* OFD unreachable */ }

  // 3. Try USDA FoodData Central — good US/international branded food coverage
  const usdaKey = process.env.USDA_API_KEY
  if (usdaKey) {
    try {
      for (const v of variants) {
        const res = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(v)}&api_key=${usdaKey}&dataType=Branded&pageSize=5`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (!res.ok) continue
        const data = await res.json()
        // Find a branded food whose GTIN/UPC matches one of our variants
        const match = (data.foods ?? []).find((f: Record<string, unknown>) =>
          f.gtinUpc && variants.includes(String(f.gtinUpc).replace(/^0+/, '').padStart(String(f.gtinUpc).length, '0'))
          || variants.includes(String(f.gtinUpc ?? ''))
        )
        if (match) {
          const getNutrient = (id: number) =>
            (match.foodNutrients as Array<{ nutrientId: number; value: number }>)
              ?.find(n => n.nutrientId === id)?.value ?? 0
          const food = {
            name: String(match.description ?? '').trim(),
            calories_per_100g: Math.round(getNutrient(1008)),
            protein_per_100g:  Math.round(getNutrient(1003) * 10) / 10,
            carbs_per_100g:    Math.round(getNutrient(1005) * 10) / 10,
            fat_per_100g:      Math.round(getNutrient(1004) * 10) / 10,
            barcode: String(match.gtinUpc ?? v),
          }
          if (food.name) return Response.json(await saveAndReturn(food))
        }
      }
    } catch { /* USDA unreachable */ }
  }

  return Response.json(null)
}
