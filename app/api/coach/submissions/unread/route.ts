import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'

export async function GET() {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ count: 0 })

  const supabase = await createClient()

  // Exclude forms that are linked to checkin_schedules — those count as check-ins, not forms
  const { data: scheduleRows } = await supabase
    .from('checkin_schedules')
    .select('form_id')
    .eq('coach_id', coachId)
    .not('form_id', 'is', null)

  const checkinFormIds = (scheduleRows ?? []).map((r) => r.form_id).filter(Boolean) as string[]

  let query = supabase
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('viewed_by_coach', false)

  if (checkinFormIds.length > 0) {
    query = query.not('form_id', 'in', `(${checkinFormIds.join(',')})`)
  }

  const { count } = await query
  return Response.json({ count: count ?? 0 })
}
