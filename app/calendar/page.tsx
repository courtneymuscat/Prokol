import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TrainingCalendar from '@/app/dashboard/TrainingCalendar'
import UpcomingBookings from './UpcomingBookings'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Access is always based on a live coach relationship, never the stored
  // subscription_tier column — that only gets literally set to 'coached'
  // during initial onboarding, so a client added to a coach afterwards
  // (already past onboarding) would otherwise be wrongly bounced here.
  const admin = createAdminClient()
  const { data: coachRel } = await admin
    .from('coach_clients')
    .select('id')
    .eq('client_id', user.id)
    .in('status', ['active', 'pending_invite'])
    .maybeSingle()
  if (!coachRel) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <UpcomingBookings />
        <TrainingCalendar />
      </div>
    </div>
  )
}
