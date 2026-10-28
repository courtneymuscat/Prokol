/**
 * Imports supabase/seeds/foundations_seed.json into the existing
 * "12-Week Nutrition Foundations" autoflow template (coach-owned draft,
 * zero clients assigned at time of writing — safe to overwrite).
 *
 * Re-runnable: resources are matched by name, and a resource's `url` is
 * only touched the first time it's created — if Court has already swapped
 * a placeholder for a real video/PDF link, re-running this script won't
 * clobber it. Steps are fully replaced every run (they're meant to be
 * edited in this file, not by hand in the coach UI, until she's happy).
 *
 * Usage:
 *   node scripts/seed_foundations.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const TEMPLATE_ID = '8ba68ce0-1f5c-439b-9bf9-5c4ccde0cdf0'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const seed = JSON.parse(
  readFileSync(join(__dirname, '..', 'supabase', 'seeds', 'foundations_seed.json'), 'utf-8'),
)

async function main() {
  const { data: template, error: templateFetchError } = await supabase
    .from('autoflow_templates')
    .select('id, coach_id')
    .eq('id', TEMPLATE_ID)
    .single()
  if (templateFetchError || !template) {
    throw new Error(`Template ${TEMPLATE_ID} not found: ${templateFetchError?.message}`)
  }
  const coachId = template.coach_id

  const { count: assignedClients } = await supabase
    .from('client_autoflows')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', TEMPLATE_ID)
  if (assignedClients && assignedClients > 0) {
    throw new Error(
      `Refusing to overwrite: ${assignedClients} client(s) are already assigned to this template. ` +
      `This script is only safe to run while it's an unassigned draft.`,
    )
  }

  // Find-or-create a "Foundations" resource folder for this coach.
  let { data: folder } = await supabase
    .from('coach_resource_folders')
    .select('id')
    .eq('coach_id', coachId)
    .eq('name', 'Foundations')
    .maybeSingle()
  if (!folder) {
    const { data: newFolder, error } = await supabase
      .from('coach_resource_folders')
      .insert({ coach_id: coachId, name: 'Foundations', color: 'green', icon: '🥗' })
      .select('id')
      .single()
    if (error) throw new Error(`Creating Foundations folder: ${error.message}`)
    folder = newFolder
  }

  // Find-or-create each resource by name. Never touch `url` on an existing
  // row — only set it at creation time (see docstring above).
  const { data: existingResources } = await supabase
    .from('coach_resources')
    .select('id, name')
    .eq('coach_id', coachId)
  const existingByName = new Map((existingResources ?? []).map(r => [r.name, r.id]))

  const resourceIdByKey = {}
  let created = 0
  for (const r of seed.resources) {
    const existingId = existingByName.get(r.name)
    if (existingId) {
      resourceIdByKey[r.key] = existingId
      continue
    }
    const { data: inserted, error } = await supabase
      .from('coach_resources')
      .insert({
        coach_id: coachId,
        folder_id: folder.id,
        name: r.name,
        type: r.type,
        url: r.url, // placeholder token, e.g. VIDEO_URL_W01 — Court replaces this later
        description: null,
      })
      .select('id')
      .single()
    if (error) throw new Error(`Creating resource "${r.name}": ${error.message}`)
    resourceIdByKey[r.key] = inserted.id
    created++
  }

  // Update the template's own metadata.
  const { error: templateUpdateError } = await supabase
    .from('autoflow_templates')
    .update({
      name: seed.template.name,
      description: seed.template.description,
      type: seed.template.type,
      total_steps: seed.template.total_steps,
      updated_at: new Date().toISOString(),
    })
    .eq('id', TEMPLATE_ID)
  if (templateUpdateError) throw new Error(`Updating template: ${templateUpdateError.message}`)

  // Upsert every step, resolving resource_keys -> real resource_ids.
  const stepRows = seed.steps.map(s => ({
    template_id: TEMPLATE_ID,
    step_number: s.step_number,
    title: s.title,
    description: s.description ?? null,
    questions: s.questions ?? [],
    day_offset: s.day_offset ?? 0,
    trigger_type: s.trigger_type ?? 'day_offset',
    trigger_step_number: s.trigger_step_number ?? null,
    resource_ids: (s.resource_keys ?? []).map(k => {
      const id = resourceIdByKey[k]
      if (!id) throw new Error(`Step ${s.step_number} references unknown resource key "${k}"`)
      return id
    }),
    form_id: null,
    form_save_to_file: false,
    tasks: s.tasks ?? [],
    automated_message: s.automated_message ?? null,
    protocol_section: s.protocol_section ?? null,
    habit: s.habit ?? null,
  }))

  const { error: stepsError } = await supabase
    .from('autoflow_template_steps')
    .upsert(stepRows, { onConflict: 'template_id,step_number' })
  if (stepsError) throw new Error(`Upserting steps: ${stepsError.message}`)

  console.log(`Template "${seed.template.name}" (${TEMPLATE_ID}) updated.`)
  console.log(`Resources: ${seed.resources.length} total, ${created} newly created, ${seed.resources.length - created} already existed (left untouched).`)
  console.log(`Steps: ${stepRows.length} upserted.`)
  console.log('No client_autoflows were created or modified — this stays an unassigned draft.')
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
