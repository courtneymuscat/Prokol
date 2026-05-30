import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  if (profile?.subscription_tier !== 'coached') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <UpcomingBookings />
        <TrainingCalendar />
      </div>
    </div>
  )
}
