import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  let { data, error } = await admin
    .from('client_plans')
    .select('id, name, start_date, phases, is_visible_to_client')
    .eq('client_id', user.id)
    .eq('is_visible_to_client', true)
    .order('updated_at', { ascending: true })

  // Fallback if is_visible_to_client column doesn't exist yet
  if (error) {
    const fallback = await admin
      .from('client_plans')
      .select('id, name, start_date, phases')
      .eq('client_id', user.id)
      .order('updated_at', { ascending: true })
    data = (fallback.data ?? []).map(p => ({ ...p, is_visible_to_client: true }))
    error = fallback.error
  }

  if (!data || data.length === 0) return Response.json([])

  // Strip coach-only notes from each plan's phases
  const sanitized = data.map((plan: Record<string, unknown>) => ({
    ...plan,
    phases: ((plan.phases ?? []) as Record<string, unknown>[]).map(
      ({ coach_week_notes: _stripped, ...rest }) => rest
    ),
  }))

  return Response.json(sanitized)
}
