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

  try {
    const url = new URL('https://search.openfoodfacts.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('page_size', String(pageSize))
    url.searchParams.set('page', String(page))

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return Response.json({ results: [], total: 0 })

    const data = await res.json()
    const total: number = data.count ?? 0

    const results = (data.hits ?? []).flatMap((p: Record<string, unknown>) => {
      const base = ((p.product_name_en || p.product_name || '') as string).trim()
      if (!base) return []

      // brands is an array in this endpoint e.g. ['VPA']
      const brandsRaw = p.brands
      const brand = Array.isArray(brandsRaw)
        ? ((brandsRaw[0] as string) ?? '').trim()
        : ((brandsRaw as string) ?? '').split(',')[0].trim()

      const name = brand && !base.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} — ${base}` : base

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

      // Parse serving size from OFF if available (e.g. "1 biscuit (35g)", "30 g")
      // Use typeof guards — serving_size can be a number in some OFF products which causes .trim() to throw
      const servingSizes: Array<{ label: string; grams: number }> = []
      const servingLabel = typeof p.serving_size === 'string' ? p.serving_size.trim() : undefined
      const servingG = typeof p.serving_quantity === 'number' ? p.serving_quantity : undefined
      if (servingLabel && servingG && servingG > 0) {
        servingSizes.push({ label: servingLabel, grams: Math.round(servingG * 10) / 10 })
      }

      return [{
        id: `off:${encodeURIComponent(name)}`,
        name,
        calories_per_100g: kcal != null ? Math.round(kcal) : 0,
        protein_per_100g:  Math.round((n['proteins_100g']      ?? 0) * 10) / 10,
        carbs_per_100g:    Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
        fat_per_100g:      Math.round((n['fat_100g']           ?? 0) * 10) / 10,
        source: 'off',
        serving_sizes: servingSizes,
      }]
    })

    return Response.json({ results, total })
  } catch {
    return Response.json({ results: [], total: 0 })
  }
}
