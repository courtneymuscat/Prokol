import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const start_date = searchParams.get('start_date')
  const end_date = searchParams.get('end_date')

  let query = supabase
    .from('habit_logs')
    .select(`
      habit_id,
      log_date,
      value,
      completed,
      habits (
        name,
        unit,
        target,
        icon
      )
    `)
    .eq('user_id', user.id)

  if (start_date) query = query.gte('log_date', start_date)
  if (end_date) query = query.lte('log_date', end_date)

  const { data, error } = await query.order('log_date', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 400 })

  const rows = (data ?? []).map((row) => {
    const habit = row.habits as { name: string; unit: string; target: number; icon: string } | null
    return {
      habit_id: row.habit_id,
      habit_name: habit?.name ?? null,
      habit_unit: habit?.unit ?? null,
      habit_target: habit?.target ?? null,
      habit_icon: habit?.icon ?? null,
      log_date: row.log_date,
      value: row.value,
      completed: row.completed,
    }
  })

  return Response.json(rows)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { habit_id, log_date, value, completed } = body

  const { data, error } = await supabase
    .from('habit_logs')
    .upsert(
      { habit_id, log_date, value, completed, user_id: user.id },
      { onConflict: 'habit_id,log_date' }
    )
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}
