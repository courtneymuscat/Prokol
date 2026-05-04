import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('client_supplements')
    .select('id, name, dosage, benefits, brand_url, notes, sort_order')
    .eq('client_id', session.user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data ?? [])
}
