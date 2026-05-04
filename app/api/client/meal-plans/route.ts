import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('client_meal_plans')
    .select('id, name, total_calories, content, status, start_date, end_date, notes, show_macros, created_at, updated_at')
    .eq('client_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}
