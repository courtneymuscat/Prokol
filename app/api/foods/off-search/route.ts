import type { NextRequest } from 'next/server'

// Proxy to search.openfoodfacts.org (Meilisearch backend).
// Browser can't call it directly — no CORS wildcard.
// cgi/search.pl is bot-blocked from servers.
// This endpoint is server-accessible and returns reliable results.

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const page = Number(req.nextUrl.searchParams.get('page') ?? '1')
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? '50')

  if (!q || q.length < 2) return Response.json({ results: [], total: 0 })

  // Split query into individual terms for name-matching filter below.
  // OFF searches all product fields (brand, category, labels) so it returns
  // e.g. "Campbell's Chicken Soup" for "chicken raw". We only keep results
  // where at least one query term actually appears in the product name.
  const queryTerms = q.toLowerCase().split(/\s+/).filter(t => t.length >= 2)

  function extractHit(p: Record<string, unknown>) {
    const base = ((p.product_name_en || p.product_name || '') as string).trim()
    if (!base) return null

    const brandsRaw = p.brands
    const brand = Array.isArray(brandsRaw)
      ? ((brandsRaw[0] as string) ?? '').trim()
      : ((brandsRaw as string) ?? '').split(',')[0].trim()

    const name = brand && !base.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} — ${base}` : base

    // Require EVERY query term to appear in name OR brand.
    const baseLower = base.toLowerCase()
    const brandLower = brand.toLowerCase()
    const combinedLower = `${brandLower} ${baseLower}`
    if (queryTerms.length > 0 && !queryTerms.every(t => combinedLower.includes(t))) return null

    const n = (p.nutriments ?? {}) as Record<string, number>

    let kcal: number | null =
      n['energy-kcal_100g'] ??
      n['energy-kcal'] ??
      (n['energy-kj_100g'] != null ? n['energy-kj_100g'] / 4.184 : null) ??
      (n['energy_100g']    != null ? n['energy_100g']    / 4.184 : null) ??
      null

    if (kcal == null) {
      const pro = n['proteins_100g'] ?? 0
      const carb = n['carbohydrates_100g'] ?? 0
      const fat = n['fat_100g'] ?? 0
      if (pro > 0 || carb > 0 || fat > 0) kcal = pro * 4 + carb * 4 + fat * 9
    }

    const servingSize = (p.serving_size as string | undefined)?.trim() ?? null

    function parseGrams(val: unknown): number | null {
      if (!val) return null
      const parsed = parseFloat(String(val).replace(/[^0-9.]/g, ''))
      return parsed > 0 && parsed < 2000 ? parsed : null
    }
    const quantityStr = p.quantity as string | undefined
    const parsedQuantity = quantityStr ? parseGrams(quantityStr.match(/(\d+(?:\.\d+)?)\s*g\b/i)?.[1]) : null
    const rawServingQty = parseGrams(p.serving_quantity)
    const rawProductQty = parseGrams(p.product_quantity) ?? parsedQuantity
    const servingQty = rawServingQty ?? (rawProductQty && rawProductQty <= 1500 ? rawProductQty : null)
    const servingLabel = servingSize ?? (servingQty && rawServingQty !== servingQty ? `${servingQty}g` : null)
    const code = (p.code as string | undefined) ?? null
    const imageUrl = (p.image_front_small_url || p.image_front_url || p.image_url || null) as string | null

    return {
      id: `off:${encodeURIComponent(name)}`,
      name,
      calories_per_100g: kcal != null ? Math.round(kcal) : 0,
      protein_per_100g:  Math.round((n['proteins_100g']      ?? 0) * 10) / 10,
      carbs_per_100g:    Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fat_per_100g:      Math.round((n['fat_100g']           ?? 0) * 10) / 10,
      source: 'off',
      ...(code ? { barcode: code } : {}),
      ...(servingQty ? { serving_quantity: servingQty } : {}),
      ...(servingLabel ? { serving_size: servingLabel } : {}),
      ...(imageUrl ? { image_url: imageUrl } : {}),
    }
  }

  async function fetchOffPage(offPage: number, offPageSize: number) {
    const url = new URL('https://search.openfoodfacts.org/search')
    url.searchParams.set('q', q!)
    url.searchParams.set('page_size', String(offPageSize))
    url.searchParams.set('page', String(offPage))
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return { hits: [], total: 0 }
    const data = await res.json()
    return { hits: (data.hits ?? []) as Record<string, unknown>[], total: (data.count ?? 0) as number }
  }

  try {
    // Fetch enough OFF pages to collect pageSize filtered results.
    // The name filter is strict (all terms must match), so many OFF hits are discarded.
    // We try up to 5 consecutive OFF pages per client request to fill the batch.
    const OFF_FETCH_SIZE = 100 // fetch 100 items from OFF per try (larger = fewer round trips)
    const MAX_TRIES = 5
    const TARGET = pageSize // collect at least this many filtered results

    // Map client page to the starting OFF page offset
    const offPageStart = (page - 1) * MAX_TRIES + 1

    const collected: ReturnType<typeof extractHit>[] = []
    let total = 0
    const seenNames = new Set<string>()

    for (let i = 0; i < MAX_TRIES; i++) {
      const { hits, total: t } = await fetchOffPage(offPageStart + i, OFF_FETCH_SIZE)
      if (i === 0 || t > 0) total = t

      for (const hit of hits) {
        const result = extractHit(hit)
        if (!result) continue
        if (seenNames.has(result.name.toLowerCase())) continue
        seenNames.add(result.name.toLowerCase())
        collected.push(result)
        if (collected.length >= TARGET) break
      }

      if (collected.length >= TARGET) break
      if (hits.length < OFF_FETCH_SIZE) break // OFF has no more results
    }

    return Response.json({ results: collected, total })
  } catch {
    return Response.json({ results: [], total: 0 })
  }
}
