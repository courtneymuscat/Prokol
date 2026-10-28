import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCoach } from '@/lib/coach'
import OpenAI from 'openai'
import type { NextRequest } from 'next/server'

const BATCH_SIZE = 10

// POST — generate how-to guides for a batch of exercises.
// Modes:
//   { exercise_ids: string[] }                  — generate only, return results for review
//   { exercise_ids: string[], auto_save: true } — generate and save immediately
//   { auto_save: true }                          — fetch next batch without guides, generate & save, return { saved_count, remaining }
export async function POST(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json() as { exercise_ids?: string[]; auto_save?: boolean }
  const { auto_save: autoSave } = body
  let exercise_ids = body.exercise_ids

  // Use the same client as the library route so RLS applies — this ensures we see
  // the same exercises (including custom ones) that show up as "no guide" in the UI.
  // Admin client is reserved for writes, which need to bypass RLS.
  const supabase = await createClient()
  const admin = createAdminClient()

  // Auto-save without explicit IDs: fetch next batch of exercises missing guides.
  // Fetch BATCH_SIZE + 1 so we can tell if more remain without a separate count query.
  // Also catch empty-string how_to ('' is not NULL in Postgres) alongside actual NULL.
  let remaining = 0
  if (autoSave && (!Array.isArray(exercise_ids) || exercise_ids.length === 0)) {
    const { data: needGuides, error: queryError } = await supabase
      .from('exercises')
      .select('id')
      .is('how_to', null)
      .limit(BATCH_SIZE + 1)
    if (queryError) {
      return Response.json({ error: `DB query failed: ${queryError.message}` }, { status: 500 })
    }
    const all = needGuides ?? []
    const hasMore = all.length > BATCH_SIZE
    exercise_ids = all.slice(0, BATCH_SIZE).map((e: { id: string }) => e.id)
    remaining = hasMore ? 1 : 0
    if (exercise_ids.length === 0) {
      return Response.json({ results: [], saved_count: 0, remaining: 0, message: 'All exercises already have guides' })
    }
  }

  if (!Array.isArray(exercise_ids) || exercise_ids.length === 0) {
    return Response.json({ error: 'exercise_ids required' }, { status: 400 })
  }

  const ids = exercise_ids.slice(0, BATCH_SIZE)
  // Use admin to fetch exercise details by the trusted IDs — the IDs already
  // passed through the coach's RLS-scoped library query so they are valid.
  const { data: exercises } = await admin
    .from('exercises')
    .select('id, name, category, equipment, muscles')
    .in('id', ids)

  if (!exercises?.length) return Response.json({ results: [], saved_count: 0, remaining })

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

    // Find the array — GPT sometimes uses a different key
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
    const msg = err instanceof Error ? err.message : String(err)
    if (autoSave) {
      return Response.json({ error: `OpenAI error: ${msg}` }, { status: 500 })
    }
    results = exercises.map((e) => ({ id: e.id, name: e.name, how_to: null }))
  }

  // Auto-save: write results directly to the shared exercises table
  if (autoSave) {
    const toSave = results.filter(r => r.how_to && r.id)
    if (toSave.length === 0) {
      return Response.json({ error: 'OpenAI returned no guides — check API key and try again' }, { status: 500 })
    }
    let saved_count = 0
    for (const r of toSave) {
      const { error } = await admin
        .from('exercises')
        .update({ how_to: r.how_to!.trim() })
        .eq('id', r.id)
      if (!error) saved_count++
    }
    return Response.json({ results, saved_count, remaining })
  }

  return Response.json({ results })
}

// PATCH — save a how-to.
// Single: { exercise_id, how_to, global }
// Bulk:   { exercises: Array<{ exercise_id, how_to }>, global }
// global=true  → saves to exercises.how_to (shared with all coaches)
// global=false → saves to coach_exercise_how_tos (per-coach override)
export async function PATCH(req: NextRequest) {
  const coachId = await requireCoach()
  if (!coachId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json() as {
    exercise_id?: string
    how_to?: string
    global?: boolean
    exercises?: Array<{ exercise_id: string; how_to: string }>
  }
  const { global: isGlobal } = body

  const admin = createAdminClient()

  // Bulk save mode
  if (Array.isArray(body.exercises) && body.exercises.length > 0) {
    let saved = 0
    const errors: string[] = []
    for (const item of body.exercises) {
      if (!item.exercise_id) continue
      if (isGlobal) {
        const { error } = await admin
          .from('exercises')
          .update({ how_to: item.how_to?.trim() || null })
          .eq('id', item.exercise_id)
        if (error) errors.push(`${item.exercise_id}: ${error.message}`)
        else saved++
      } else {
        const text = item.how_to?.trim() || null
        if (text) {
          const { error } = await admin
            .from('coach_exercise_how_tos')
            .upsert({ coach_id: coachId, exercise_id: item.exercise_id, how_to: text }, { onConflict: 'coach_id,exercise_id' })
          if (error) errors.push(`${item.exercise_id}: ${error.message}`)
          else saved++
        }
      }
    }
    if (errors.length > 0) {
      return Response.json({ saved, errors }, { status: errors.length === body.exercises.length ? 500 : 207 })
    }
    return Response.json({ ok: true, saved })
  }

  // Single save mode
  const { exercise_id, how_to } = body
  if (!exercise_id) return Response.json({ error: 'exercise_id required' }, { status: 400 })

  if (isGlobal) {
    const { error } = await admin
      .from('exercises')
      .update({ how_to: how_to?.trim() || null })
      .eq('id', exercise_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  } else {
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
      await admin
        .from('coach_exercise_how_tos')
        .delete()
        .eq('coach_id', coachId)
        .eq('exercise_id', exercise_id)
    }
  }

  return Response.json({ ok: true })
}
