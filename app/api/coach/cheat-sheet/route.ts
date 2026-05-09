import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import { resolveOrgSharedUserId } from '@/lib/org'
import { NextResponse } from 'next/server'

// GET /api/coach/cheat-sheet
// Returns all default foods merged with coach's customisations.
// For invited org coaches the customisations come from the org owner so the
// whole organisation sees the same cheat sheet.
export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: sourceUserId, isMember, orgName } = await resolveOrgSharedUserId(coachId)
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: foods }, { data: overrides }] = await Promise.all([
    supabase.from('cheat_sheet_foods').select('*').order('display_order'),
    // Use admin client when reading the owner's overrides — RLS would otherwise
    // hide the owner's rows from the invited coach.
    admin.from('coach_cheat_sheet').select('*').eq('coach_id', sourceUserId),
  ])

  const overrideMap = Object.fromEntries((overrides ?? []).map((o) => [o.food_id ?? `custom_${o.id}`, o]))

  // Merge: defaults first, then custom coach-added foods
  const merged = (foods ?? []).map((f) => {
    const o = overrideMap[f.id]
    return {
      ...f,
      is_hidden: o?.is_hidden ?? false,
      custom_order: o?.display_order ?? null,
    }
  })

  // Coach's fully custom foods (food_id = null)
  const customFoods = (overrides ?? [])
    .filter((o) => !o.food_id)
    .map((o) => ({
      id: o.id,
      name: o.name,
      serving_desc: o.serving_desc,
      calories: o.calories,
      protein_g: o.protein_g,
      carbs_g: o.carbs_g,
      fat_g: o.fat_g,
      primary_category: o.primary_category,
      secondary_categories: o.secondary_categories ?? [],
      subcategory: o.subcategory,
      display_order: o.display_order ?? 999,
      is_default: false,
      is_hidden: false,
      is_custom: true,
    }))

  return NextResponse.json({
    foods: [...merged, ...customFoods],
    org_managed: isMember ? { org_name: orgName } : null,
  })
}

// POST /api/coach/cheat-sheet — add a custom food
export async function POST(req: Request) {
  const coachId = await requireCoach()
  if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Member coaches don't get to edit the org-shared cheat sheet
  const { isMember } = await resolveOrgSharedUserId(coachId)
  if (isMember) {
    return NextResponse.json(
      { error: 'Cheat sheet is managed by your organisation' },
      { status: 403 },
    )
  }

  const body = await req.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coach_cheat_sheet')
    .insert({
      coach_id: coachId,
      food_id: null,
      name: body.name,
      serving_desc: body.serving_desc || null,
      calories: body.calories ?? null,
      protein_g: body.protein_g ?? 0,
      carbs_g: body.carbs_g ?? 0,
      fat_g: body.fat_g ?? 0,
      primary_category: body.primary_category,
      secondary_categories: body.secondary_categories ?? [],
      subcategory: body.subcategory ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ food: data })
}
