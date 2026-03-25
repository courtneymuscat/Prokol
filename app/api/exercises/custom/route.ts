import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { name, category, equipment } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: name.trim(),
      category: category || 'other',
      equipment: equipment || 'bodyweight',
      is_custom: true,
      created_by: session.user.id,
    })
    .select('id, name, category, equipment, muscles, video_url')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
