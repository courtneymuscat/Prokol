import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TrainingCalendar from '@/app/dashboard/TrainingCalendar'
import UpcomingBookings from './UpcomingBookings'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_tier !== 'coached') {
    // Fallback: allow access if they have an active coach relationship
    // (handles clients whose stored tier hasn't been upgraded yet)
    const admin = createAdminClient()
    const { data: coachRel } = await admin
      .from('coach_clients')
      .select('id')
      .eq('client_id', user.id)
      .in('status', ['active', 'pending_invite'])
      .maybeSingle()
    if (!coachRel) redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <UpcomingBookings />
        <TrainingCalendar />
      </div>
    </div>
  )
}
