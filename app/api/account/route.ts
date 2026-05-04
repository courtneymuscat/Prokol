import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const userId = user.id
  const service = createServiceClient()

  // ── 1. Cancel Stripe subscription ────────────────────────────────────────
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_subscription_id) {
    try {
      const stripe = getStripe()
      await stripe.subscriptions.cancel(profile.stripe_subscription_id)
    } catch (err) {
      console.error('[delete-account] Stripe cancel error:', err)
      // Non-fatal — proceed with deletion
    }
  }

  // ── 2. Collect storage paths for cleanup before deleting rows ─────────────
  const { data: photos } = await service
    .from('progress_photos')
    .select('storage_path')
    .eq('user_id', userId)

  const photoStoragePaths = (photos ?? []).map((p) => p.storage_path).filter(Boolean) as string[]

  // ── 3. Personal data — simple user_id rows ───────────────────────────────
  await service.from('food_logs').delete().eq('user_id', userId)
  await service.from('weight_logs').delete().eq('user_id', userId)
  await service.from('check_ins').delete().eq('user_id', userId)
  await service.from('cycle_logs').delete().eq('user_id', userId)
  await service.from('meal_notes').delete().eq('user_id', userId)
  await service.from('user_food_history').delete().eq('user_id', userId)
  await service.from('push_subscriptions').delete().eq('user_id', userId)

  // ── 4. Workouts (workout_exercises + exercise_sets cascade via FK) ─────────
  await service.from('workouts').delete().eq('user_id', userId)

  // ── 5. Custom exercises ───────────────────────────────────────────────────
  await service.from('exercises').delete().eq('created_by', userId)

  // ── 6. Progress photos — storage then DB ─────────────────────────────────
  if (photoStoragePaths.length) {
    await service.storage.from('progress-photos').remove(photoStoragePaths)
  }
  await service.from('progress_photos').delete().eq('user_id', userId)

  // ── 7. Messaging ──────────────────────────────────────────────────────────
  await service.from('messages').delete().eq('sender_id', userId)
  await service.from('conversations').delete().or(`coach_id.eq.${userId},client_id.eq.${userId}`)

  // ── 8. Autoflow responses (must precede client_autoflows) ─────────────────
  await service.from('autoflow_responses').delete().eq('client_id', userId)

  // ── 9. Form submissions (form_answers cascade via FK) ─────────────────────
  await service.from('form_submissions').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('form_responses').delete().eq('user_id', userId) // legacy table

  // ── 10. Habit logs (must precede habits) ──────────────────────────────────
  await service.from('habit_logs').delete().eq('client_id', userId)

  // ── 11. Client coaching records (covers both client-side and coach-side) ──
  await service.from('habits').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('client_goals').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('client_meal_plans').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('client_programs').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('client_protocol').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('client_supplements').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('client_files').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('client_autoflows').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('client_resource_access').delete().eq('client_id', userId)
  await service.from('client_serve_targets').delete().eq('client_id', userId)
  await service.from('checkin_schedules').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('calendar_events').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)

  // ── 12. Coach-client relationships ───────────────────────────────────────
  // Collect active coaching relationships before deletion so we can decrement seat counts
  const { data: activeCoachRelationships } = await service
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', userId)
    .eq('status', 'active')

  await service.from('coach_clients').delete().or(`coach_id.eq.${userId},client_id.eq.${userId}`)
  await service.from('coach_invites').delete().eq('coach_id', userId)
  await service.from('coach_notes').delete().or(`coach_id.eq.${userId},client_id.eq.${userId}`)

  // Decrement each coach's seat count now that the client relationship is gone
  for (const { coach_id } of activeCoachRelationships ?? []) {
    const { data: coachProfile } = await service
      .from('profiles')
      .select('subscription_seat_count')
      .eq('id', coach_id)
      .single()
    const currentCount = (coachProfile?.subscription_seat_count as number) ?? 0
    if (currentCount > 0) {
      await service
        .from('profiles')
        .update({ subscription_seat_count: currentCount - 1 })
        .eq('id', coach_id)
    }
  }

  // ── 13. Coach-owned content ───────────────────────────────────────────────
  await service.from('coach_services').delete().eq('coach_id', userId)
  await service.from('coach_supplements').delete().eq('coach_id', userId)
  await service.from('coach_food_serves').delete().eq('coach_id', userId)
  await service.from('coach_cheat_sheet').delete().eq('coach_id', userId)
  await service.from('coach_resources').delete().eq('coach_id', userId)
  await service.from('coach_resource_folders').delete().eq('coach_id', userId)
  await service.from('note_templates').delete().eq('coach_id', userId)
  // autoflow_template_steps cascade from autoflow_templates via FK
  await service.from('autoflow_templates').delete().eq('coach_id', userId)
  // form_questions cascade from forms via FK
  await service.from('forms').delete().eq('coach_id', userId)
  await service.from('meal_plans').delete().eq('coach_id', userId)
  await service.from('programs').delete().eq('coach_id', userId)

  // ── 14. Org membership ────────────────────────────────────────────────────
  await service.from('org_client_assignments').delete().or(`client_id.eq.${userId},coach_id.eq.${userId}`)
  await service.from('org_coach_permissions').delete().eq('coach_id', userId)
  await service.from('org_members').delete().eq('user_id', userId)

  // ── 15. Coach logo from storage (best-effort) ─────────────────────────────
  try {
    const { data: logoFiles } = await service.storage
      .from('org-assets')
      .list(`coach-logos/${userId}`)
    if (logoFiles?.length) {
      await service.storage
        .from('org-assets')
        .remove(logoFiles.map((f) => `coach-logos/${userId}/${f.name}`))
    }
  } catch {
    // Non-fatal
  }

  // ── 16. Profile row (FK to auth.users — must precede deleteUser) ──────────
  await service.from('profiles').delete().eq('id', userId)

  // ── 17. Delete auth user — invalidates all sessions ───────────────────────
  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) {
    console.error('[delete-account] Auth delete error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
