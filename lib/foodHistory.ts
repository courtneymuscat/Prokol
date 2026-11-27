// Records a food into user_food_history so it can appear under "recent"
// before the client has typed anything.
//
// Shared rather than repeated at each call site because the previous inline
// copies silently diverged from the table's actual columns and nothing ever
// got written — the writes are fire-and-forget, so there was no error
// anywhere to notice.

type HistoryFood = {
  id?: string | null
  name: string
  calories_per_100g?: number | null
  protein_per_100g?: number | null
  carbs_per_100g?: number | null
  fat_per_100g?: number | null
  fibre_per_100g?: number | null
  unit?: string | null
  serving_quantity?: number | null
  serving_size?: string | null
}

// A search result's id is only a food_database uuid some of the time — it can
// equally be an Open Food Facts barcode, which this column cannot hold.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Structural rather than importing SupabaseClient: this is called with both
// the browser and server clients, whose generics differ.
type InsertableClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>
  }
}

export async function recordFoodHistory(
  supabase: InsertableClient,
  userId: string,
  food: HistoryFood,
): Promise<void> {
  if (!food?.name) return

  const { error } = await supabase.from('user_food_history').insert({
    user_id: userId,
    food_id: food.id && UUID.test(food.id) ? food.id : null,
    name: food.name,
    calories_per_100g: food.calories_per_100g ?? null,
    protein_per_100g: food.protein_per_100g ?? null,
    carbs_per_100g: food.carbs_per_100g ?? null,
    fat_per_100g: food.fat_per_100g ?? null,
    fibre_per_100g: food.fibre_per_100g ?? null,
    unit: food.unit ?? null,
    serving_quantity: food.serving_quantity ?? null,
    serving_size: food.serving_size ?? null,
  })

  // Logged, not thrown: a client has logged their food either way, and
  // failing their save over a recents entry would be worse than losing it.
  if (error) console.error('recordFoodHistory:', error.message)
}
