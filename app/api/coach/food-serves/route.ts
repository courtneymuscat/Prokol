import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { resolveOrgSharedUserId } from '@/lib/org'
import { NextResponse } from 'next/server'

// GET /api/coach/food-serves — list all tagged foods for this coach.
// For invited org coaches the list is sourced from the org owner so the whole
// organisation sees the same food cheat sheet.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: sourceUserId, isMember, orgName } = await resolveOrgSharedUserId(coachId)
  // Use admin client when reading the owner's rows so RLS doesn't strip them
  // from an invited coach's response.
  const client = isMember ? createAdminClient() : await createClient()

  const { data } = await client
    .from('coach_food_serves')
    .select('*')
    .eq('coach_id', sourceUserId)
    .order('serve_category')
    .order('food_name')

  return NextResponse.json({
    foods: data ?? [],
    org_managed: isMember ? { org_name: orgName } : null,
  })
}

// POST /api/coach/food-serves — tag a food with a serve category
export async function POST(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isMember } = await resolveOrgSharedUserId(coachId)
  if (isMember) {
    return NextResponse.json(
      { error: 'Food cheat sheet is managed by your organisation' },
      { status: 403 },
    )
  }

  const body = await req.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coach_food_serves')
    .upsert({
      coach_id: coachId,
      food_name: body.food_name,
      food_db_id: body.food_db_id ?? null,
      serve_category: body.serve_category,
      subcategory: body.subcategory ?? null,
      secondary_categories: body.secondary_categories ?? [],
      serving_desc: body.serving_desc ?? null,
      household_measure: body.household_measure ?? null,
      calories_per_serve: body.calories_per_serve ?? null,
      protein_per_serve: body.protein_per_serve ?? null,
      carbs_per_serve: body.carbs_per_serve ?? null,
      fat_per_serve: body.fat_per_serve ?? null,
    }, { onConflict: 'coach_id,food_name' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ food: data })
}
