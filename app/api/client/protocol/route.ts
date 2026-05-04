import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('client_protocol')
    .select('sections')
    .eq('client_id', session.user.id)
    .maybeSingle()

  return Response.json({ sections: data?.sections ?? [] })
}
