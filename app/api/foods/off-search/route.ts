import type { NextRequest } from 'next/server'

// Server-side proxy to Open Food Facts search.
// Calling from the server eliminates browser CORS restrictions.
// Uses the proven /cgi/search.pl endpoint (v2 text search is barcode-only).

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const page = Number(req.nextUrl.searchParams.get('page') ?? '1')
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? '50')

  if (!q || q.length < 2) return Response.json({ results: [], total: 0 })

  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', q)
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('fields', 'product_name,product_name_en,brands,nutriments')
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('page', String(page))
  url.searchParams.set('sort_by', 'unique_scans_n')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'NutriCoach/1.0 (https://nutricoach.app)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return Response.json({ results: [], total: 0 })

    const data = await res.json()
    const total: number = data.count ?? 0

    const results = (data.products ?? []).flatMap((p: Record<string, unknown>) => {
      const base = ((p.product_name_en || p.product_name || '') as string).trim()
      if (!base) return []

      const brand = ((p.brands as string) ?? '').split(',')[0].trim()
      const name = brand && !base.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} — ${base}`
        : base

      const n = (p.nutriments ?? {}) as Record<string, number>
      // Try kcal directly, fall back to kJ÷4.184
      const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : null)
      if (kcal == null || kcal < 0) return []

      return [{
        id: `off:${encodeURIComponent(name)}`,
        name,
        calories_per_100g: Math.round(kcal),
        protein_per_100g:  Math.round((n['proteins_100g']       ?? 0) * 10) / 10,
        carbs_per_100g:    Math.round((n['carbohydrates_100g']  ?? 0) * 10) / 10,
        fat_per_100g:      Math.round((n['fat_100g']            ?? 0) * 10) / 10,
        source: 'off',
      }]
    })

    return Response.json({ results, total })
  } catch {
    return Response.json({ results: [], total: 0 })
  }
}
