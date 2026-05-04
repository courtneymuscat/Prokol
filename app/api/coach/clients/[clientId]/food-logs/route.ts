import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import type { NextRequest } from 'next/server'

// GET /api/coach/clients/[clientId]/food-logs?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const start_date = searchParams.get('start_date')
  const end_date   = searchParams.get('end_date')

  const admin = createAdminClient()

  // Verify coach → client relationship
  const { data: rel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .in('status', ['active', 'archived', 'pending_invite'])
    .single()
  if (!rel) return Response.json({ error: 'Forbidden' }, { status: 403 })

  let foodQuery = admin
    .from('food_logs')
    .select('id, log_date, meal_type, food_name, calories, protein, carbs, fat, scan_image_url, meal_notes, meal_photo_url, created_at')
    .eq('user_id', clientId)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: true })

  let notesQuery = admin
    .from('meal_notes')
    .select('log_date, meal_type, note, photo_url')
    .eq('user_id', clientId)
    .order('log_date', { ascending: false })

  if (start_date) { foodQuery = foodQuery.gte('log_date', start_date); notesQuery = notesQuery.gte('log_date', start_date) }
  if (end_date)   { foodQuery = foodQuery.lte('log_date', end_date);   notesQuery = notesQuery.lte('log_date', end_date) }

  const [foodResult, notesResult, profileResult] = await Promise.all([
    foodQuery,
    notesQuery,
    admin.from('profiles').select('timezone').eq('id', clientId).single(),
  ])

  return Response.json({
    foodLogs:        foodResult.data  ?? [],
    mealNotes:       notesResult.data ?? [],
    clientTimezone:  (profileResult.data as { timezone?: string | null } | null)?.timezone ?? null,
  })
}
