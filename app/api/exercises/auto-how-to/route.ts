import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import OpenAI from 'openai'
import type { NextRequest } from 'next/server'

const BATCH_SIZE = 10

// POST — generate how-to guides for a batch of exercises
export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { exercise_ids } = await req.json()
  if (!Array.isArray(exercise_ids) || exercise_ids.length === 0) {
    return Response.json({ error: 'exercise_ids required' }, { status: 400 })
  }

  const ids = exercise_ids.slice(0, BATCH_SIZE)
  const admin = createAdminClient()
  const { data: exercises } = await admin
    .from('exercises')
    .select('id, name, category, equipment, muscles')
    .in('id', ids)

  if (!exercises?.length) return Response.json({ results: [] })

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const list = exercises
    .map((e) => `- ${e.name} (${e.category ?? 'general'}, ${e.equipment ?? 'any'})`)
    .join('\n')

  const prompt = `You are a certified personal trainer. For each exercise below, write a concise execution guide (3–5 steps) focused on setup and key form cues. Be direct and practical — no preamble, no markdown headers, just numbered steps.

Exercises:
${list}

Respond with a JSON object in exactly this format:
{"results": [{"id": "<exercise name exactly as given>", "how_to": "1. First step.\\n2. Second step.\\n3. Third step."}]}

Example:
{"results": [{"id":"Barbell Squat","how_to":"1. Stand with feet shoulder-width apart, bar across upper traps.\\n2. Brace core and unrack the bar.\\n3. Descend until thighs are parallel, keeping chest tall.\\n4. Drive through heels to stand.\\n5. Keep knees tracking over toes throughout."}]}`

  let results: { id: string; name: string; how_to: string | null }[] = []

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    // Find the array — GPT sometimes uses a different key, so search all values
    let items: { id: string; how_to: string }[] = []
    if (Array.isArray(parsed.results)) {
      items = parsed.results
    } else {
      const arrayVal = Object.values(parsed).find((v) => Array.isArray(v))
      if (arrayVal) items = arrayVal as { id: string; how_to: string }[]
    }

    const nameToId = Object.fromEntries(exercises.map((e) => [e.name, e.id]))

    results = items.map((item) => ({
      id: nameToId[item.id] ?? item.id,
      name: item.id,
      how_to: item.how_to ?? null,
    }))
  } catch (err) {
    console.error('[auto-how-to] generation error:', err)
    results = exercises.map((e) => ({ id: e.id, name: e.name, how_to: null }))
  }

  return Response.json({ results })
}

// PATCH — save a how-to.
// global=true  → saves to exercises.how_to (shared with all coaches, used when approving auto-generated guides)
// global=false → saves to coach_exercise_how_tos (per-coach override, used when a coach manually edits)
export async function PATCH(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { exercise_id, how_to, global: isGlobal } = await req.json()
  if (!exercise_id) return Response.json({ error: 'exercise_id required' }, { status: 400 })

  const admin = createAdminClient()

  if (isGlobal) {
    // Auto-generate approval: write to the shared exercises table so all coaches benefit
    const { error } = await admin
      .from('exercises')
      .update({ how_to: how_to?.trim() || null })
      .eq('id', exercise_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  } else {
    // Manual coach edit: write to per-coach override table (upsert)
    const text = how_to?.trim() || null
    if (text) {
      const { error } = await admin
        .from('coach_exercise_how_tos')
        .upsert(
          { coach_id: coachId, exercise_id, how_to: text },
          { onConflict: 'coach_id,exercise_id' }
        )
      if (error) return Response.json({ error: error.message }, { status: 500 })
    } else {
      // Clearing override — delete the row so the global guide shows again
      await admin
        .from('coach_exercise_how_tos')
        .delete()
        .eq('coach_id', coachId)
        .eq('exercise_id', exercise_id)
    }
  }

  return Response.json({ ok: true })
}
