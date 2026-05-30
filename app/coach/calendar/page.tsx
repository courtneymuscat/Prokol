import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireCoach } from '@/lib/coach'
import CoachCalendar from './CoachCalendar'

export default async function CoachCalendarPage() {
  const coachId = await requireCoach()
  if (!coachId) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', coachId)
    .single()

  return <CoachCalendar coachId={coachId} coachTz={profile?.timezone || 'UTC'} />
}
