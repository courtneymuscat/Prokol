import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe'

// Deleting a user from the Supabase dashboard fails for anyone who has used
// the app: `profiles` and its children reference auth.users without a cascade
// rule, so Postgres refuses the delete and GoTrue reports a generic
// "Database error deleting user". Everything below runs in dependency order
// so the auth row is free to go by the time we ask for it.

/**
 * Removes every row this user owns, plus their profile and storage objects.
 * Stops short of the auth record — see `deleteUserCompletely`.
 */
export async function purgeUserData(userId: string): Promise<void> {
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
      console.error('[delete-user] Stripe cancel error:', err)
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
  // foods and meals hang off auth.users rather than profiles, so unlike most
  // tables here they don't disappear when the profile row cascades — without
  // these two the user's custom foods and saved meals outlive the account.
  // meal_items cascade from meals via FK.
  await service.from('meals').delete().eq('user_id', userId)
  await service.from('foods').delete().eq('user_id', userId)
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

  // ── 16. Audit-log references ──────────────────────────────────────────────
  // admin_audit_log.target_user_id points at auth.users with no cascade, so
  // any row naming this user would block the delete below. The action itself
  // stays in the log with target_user_id cleared.
  await service.from('admin_audit_log').update({ target_user_id: null }).eq('target_user_id', userId)
  await service.from('admin_audit_log').delete().eq('admin_id', userId)

  // ── 17. Profile row (FK to auth.users — must precede deleteUser) ──────────
  await service.from('profiles').delete().eq('id', userId)
}

/**
 * Full account removal: every owned row, then the auth record itself. Safe to
 * run against a user whose auth record is already gone — the purge still
 * clears any rows left orphaned behind it.
 */
export async function deleteUserCompletely(userId: string): Promise<{ error?: string }> {
  const service = createServiceClient()

  // organisations.owner_id is ON DELETE RESTRICT, so an owned org makes the
  // auth delete fail — and it should: the org's coaches, clients and content
  // outlive this one account, so ownership has to move before the owner goes.
  // Checked up front so we report it instead of purging their data and then
  // failing at the last step.
  const { data: ownedOrgs } = await service
    .from('organisations')
    .select('name')
    .eq('owner_id', userId)

  if (ownedOrgs?.length) {
    const names = ownedOrgs.map((o) => o.name as string).join(', ')
    return { error: `This user still owns ${ownedOrgs.length === 1 ? 'an organisation' : 'organisations'} (${names}). Transfer ownership before deleting them.` }
  }

  await purgeUserData(userId)
  const { error } = await service.auth.admin.deleteUser(userId)

  // An already-missing auth row means the data purge above was the only work
  // left to do, so treat it as success rather than surfacing a confusing error.
  if (error && !/user not found/i.test(error.message)) {
    console.error('[delete-user] Auth delete error:', error.message)
    return { error: error.message }
  }

  return {}
}
