import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/client/food-serves
// ?list=true  → full food list for cheat sheet display
// default     → lowercased name→category map for serve badge lookup
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ map: {}, foods: [] })

  const { searchParams } = new URL(req.url)
  const list = searchParams.get('list') === 'true'

  const admin = createAdminClient()

  const { data: rel } = await admin
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', session.user.id)
    .eq('status', 'active')
    .single()

  if (!rel) return NextResponse.json({ map: {}, foods: [] })

  const { data: tags } = await admin
    .from('coach_food_serves')
    .select('id, food_name, serve_category, secondary_categories, subcategory, serving_desc, household_measure, calories_per_serve, protein_per_serve, carbs_per_serve, fat_per_serve')
    .eq('coach_id', rel.coach_id)
    .order('serve_category')
    .order('food_name')

  if (list) return NextResponse.json({ foods: tags ?? [] })

  const map: Record<string, {
    category: string
    secondary: string[]
    protein_per_serve: number | null
    carbs_per_serve: number | null
    fat_per_serve: number | null
  }> = {}
  for (const t of tags ?? []) {
    map[t.food_name.toLowerCase()] = {
      category: t.serve_category,
      secondary: t.secondary_categories ?? [],
      protein_per_serve: t.protein_per_serve ?? null,
      carbs_per_serve:   t.carbs_per_serve   ?? null,
      fat_per_serve:     t.fat_per_serve     ?? null,
    }
  }

  return NextResponse.json({ map })
}
