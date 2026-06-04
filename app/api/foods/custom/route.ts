import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_quantity, serving_size } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('foods')
    .insert({
      user_id: session.user.id,
      name: name.trim(),
      calories_per_100g: calories_per_100g ?? 0,
      protein_per_100g: protein_per_100g ?? 0,
      carbs_per_100g: carbs_per_100g ?? 0,
      fat_per_100g: fat_per_100g ?? 0,
      serving_quantity: serving_quantity ?? null,
      serving_size: serving_size ?? null,
    })
    .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_quantity, serving_size')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
