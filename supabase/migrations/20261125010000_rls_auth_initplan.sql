-- Evaluate auth.uid()/auth.role() once per query instead of once per row.
--
-- Supabase's performance advisor flagged 184 'Auth RLS Initialization Plan'
-- warnings: a policy calling auth.uid() directly is re-evaluated for every
-- row scanned. Wrapping it in a scalar subquery makes Postgres compute it a
-- single time as an InitPlan. The value is identical, so each policy permits
-- and denies exactly what it did before — this is purely how often the check
-- runs, not what it checks.
--
-- ALTER POLICY rather than DROP/CREATE on purpose: it rewrites only the
-- expression and leaves each policy's command and roles untouched, so there
-- is no window where a table sits unprotected and no chance of silently
-- changing who a policy applies to.


alter policy "platform admin only" on public.admin_audit_log
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));

alter policy "Client reads own flags" on public.autoflow_response_flags
  USING ((client_id = (select auth.uid())));

alter policy "Coach manages own client flags" on public.autoflow_response_flags
  USING ((coach_id = (select auth.uid())));

alter policy "Client manages own autoflow responses" on public.autoflow_responses
  USING (((select auth.uid()) = client_id));

alter policy "Coach reads client autoflow responses" on public.autoflow_responses
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_responses.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));

alter policy "Client manages own dismissals" on public.autoflow_step_dismissals
  USING (((select auth.uid()) = client_id));

alter policy "Coach reads client dismissals" on public.autoflow_step_dismissals
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_dismissals.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));

alter policy "Client reads own step habit instances" on public.autoflow_step_habit_instances
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_habit_instances.client_autoflow_id) AND (f.client_id = (select auth.uid()))))));

alter policy "Coach manages step habit instances" on public.autoflow_step_habit_instances
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_habit_instances.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));

alter policy "Client reads own step nutrition instances" on public.autoflow_step_nutrition_instances
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_nutrition_instances.client_autoflow_id) AND (f.client_id = (select auth.uid()))))));

alter policy "Coach manages step nutrition instances" on public.autoflow_step_nutrition_instances
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_nutrition_instances.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));

alter policy "Client reads own step program instances" on public.autoflow_step_program_instances
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_program_instances.client_autoflow_id) AND (f.client_id = (select auth.uid()))))));

alter policy "Coach manages step program instances" on public.autoflow_step_program_instances
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_program_instances.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));

alter policy "Coach manages own template steps" on public.autoflow_template_steps
  USING ((EXISTS ( SELECT 1
   FROM autoflow_templates t
  WHERE ((t.id = autoflow_template_steps.template_id) AND (t.coach_id = (select auth.uid()))))));

alter policy "Coach manages own autoflow templates" on public.autoflow_templates
  USING (((select auth.uid()) = coach_id));

alter policy "Clients read their coach's booking services" on public.booking_services
  USING ((EXISTS ( SELECT 1
   FROM coach_clients cc
  WHERE ((cc.coach_id = booking_services.coach_id) AND (cc.client_id = (select auth.uid())) AND (cc.status = 'active'::text)))));

alter policy "Coach manages own booking services" on public.booking_services
  USING (((select auth.uid()) = coach_id));

alter policy "Client reads own bookings" on public.bookings
  USING (((select auth.uid()) = client_id));

alter policy "Coach manages own bookings" on public.bookings
  USING (((select auth.uid()) = coach_id));

alter policy "Client reads own calendar events" on public.calendar_events
  USING (((select auth.uid()) = client_id));

alter policy "Coach manages calendar events" on public.calendar_events
  USING (((select auth.uid()) = coach_id));

alter policy "cheat_sheet_foods_read" on public.cheat_sheet_foods
  USING (((select auth.role()) = 'authenticated'::text));

alter policy "Users manage own check-ins" on public.check_ins
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

alter policy "client inserts own checkin answers" on public.checkin_answers
  WITH CHECK ((checkin_id IN ( SELECT checkins.id
   FROM checkins
  WHERE (checkins.client_id = (select auth.uid())))));

alter policy "client reads own checkin answers" on public.checkin_answers
  USING ((checkin_id IN ( SELECT checkins.id
   FROM checkins
  WHERE (checkins.client_id = (select auth.uid())))));

alter policy "coach reads client checkin answers" on public.checkin_answers
  USING ((checkin_id IN ( SELECT checkins.id
   FROM checkins
  WHERE (checkins.client_id IN ( SELECT coach_clients.client_id
           FROM coach_clients
          WHERE ((coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))))));

alter policy "client reads assigned checkin forms" on public.checkin_forms
  USING ((id IN ( SELECT checkin_schedules.form_id
   FROM checkin_schedules
  WHERE (checkin_schedules.client_id = (select auth.uid())))));

alter policy "coach manages own checkin forms" on public.checkin_forms
  USING ((coach_id = (select auth.uid())));

alter policy "client reads questions in assigned forms" on public.checkin_questions
  USING ((form_id IN ( SELECT checkin_schedules.form_id
   FROM checkin_schedules
  WHERE (checkin_schedules.client_id = (select auth.uid())))));

alter policy "coach manages own checkin questions" on public.checkin_questions
  USING ((form_id IN ( SELECT checkin_forms.id
   FROM checkin_forms
  WHERE (checkin_forms.coach_id = (select auth.uid())))));

alter policy "client_view_checkin_schedules" on public.checkin_schedules
  USING (((client_id = (select auth.uid())) AND (is_active = true)));

alter policy "coach_manage_checkin_schedules" on public.checkin_schedules
  USING ((coach_id = (select auth.uid())));

alter policy "client manages own checkins" on public.checkins
  USING ((client_id = (select auth.uid())));

alter policy "coach reads client checkins" on public.checkins
  USING ((client_id IN ( SELECT coach_clients.client_id
   FROM coach_clients
  WHERE ((coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));

alter policy "Client reads own step overrides" on public.client_autoflow_step_overrides
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = client_autoflow_step_overrides.client_autoflow_id) AND (f.client_id = (select auth.uid()))))));

alter policy "Coach manages step overrides" on public.client_autoflow_step_overrides
  USING ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = client_autoflow_step_overrides.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));

alter policy "Client reads own autoflows" on public.client_autoflows
  USING (((select auth.uid()) = client_id));

alter policy "Coach manages client autoflows" on public.client_autoflows
  USING (((select auth.uid()) = coach_id));

alter policy "client reads own files" on public.client_files
  USING ((client_id = (select auth.uid())));

alter policy "coach manages client files" on public.client_files
  USING ((coach_id = (select auth.uid())));

alter policy "client_read_goals" on public.client_goals
  USING ((client_id = (select auth.uid())));

alter policy "coach_manage_goals" on public.client_goals
  USING ((coach_id = (select auth.uid())));

alter policy "Client reads own meal plans" on public.client_meal_plans
  USING (((select auth.uid()) = client_id));

alter policy "Client updates own meal plans" on public.client_meal_plans
  USING (((select auth.uid()) = client_id));

alter policy "Coach manages client meal plans" on public.client_meal_plans
  USING (((select auth.uid()) = coach_id));

alter policy "Client reads own plan" on public.client_plans
  USING (((select auth.uid()) = client_id));

alter policy "Coach manages client plan" on public.client_plans
  USING (((select auth.uid()) = coach_id));

alter policy "Client reads own programs" on public.client_programs
  USING (((select auth.uid()) = client_id));

alter policy "Coach manages client programs" on public.client_programs
  USING (((select auth.uid()) = coach_id));

alter policy "Client reads own protocol" on public.client_protocol
  USING (((select auth.uid()) = client_id));

alter policy "Coach manages client protocol" on public.client_protocol
  USING (((select auth.uid()) = coach_id));

alter policy "client manages own recipe ingredients" on public.client_recipe_ingredients
  USING ((EXISTS ( SELECT 1
   FROM client_recipes
  WHERE ((client_recipes.id = client_recipe_ingredients.recipe_id) AND (client_recipes.user_id = (select auth.uid()))))));

alter policy "client manages own recipes" on public.client_recipes
  USING ((user_id = (select auth.uid())));

alter policy "Client reads own resource access" on public.client_resource_access
  USING ((client_id = (select auth.uid())));

alter policy "Coach manages client resource access" on public.client_resource_access
  USING ((coach_id = (select auth.uid())));

alter policy "serve_targets_client_read" on public.client_serve_targets
  USING ((client_id = (select auth.uid())));

alter policy "serve_targets_coach" on public.client_serve_targets
  USING ((coach_id = (select auth.uid())));

alter policy "Client reads own supplements" on public.client_supplements
  USING (((select auth.uid()) = client_id));

alter policy "Coach manages client supplements" on public.client_supplements
  USING (((select auth.uid()) = coach_id));

alter policy "Coach manages own tag assignments" on public.client_tag_assignments
  USING ((coach_id = (select auth.uid())));

alter policy "Coach manages own tags" on public.client_tags
  USING ((coach_id = (select auth.uid())));

alter policy "Clients read their coach's availability" on public.coach_availability
  USING ((EXISTS ( SELECT 1
   FROM coach_clients cc
  WHERE ((cc.coach_id = coach_availability.coach_id) AND (cc.client_id = (select auth.uid())) AND (cc.status = 'active'::text)))));

alter policy "Coach manages own availability" on public.coach_availability
  USING (((select auth.uid()) = coach_id));

alter policy "coach_cheat_sheet_delete" on public.coach_cheat_sheet
  USING ((coach_id = (select auth.uid())));

alter policy "coach_cheat_sheet_insert" on public.coach_cheat_sheet
  WITH CHECK ((coach_id = (select auth.uid())));

alter policy "coach_cheat_sheet_select" on public.coach_cheat_sheet
  USING ((coach_id = (select auth.uid())));

alter policy "coach_cheat_sheet_update" on public.coach_cheat_sheet
  USING ((coach_id = (select auth.uid())));

alter policy "Clients can view and leave their own relationships" on public.coach_clients
  USING ((client_id = (select auth.uid())));

alter policy "Coaches can manage their client relationships" on public.coach_clients
  USING ((coach_id = (select auth.uid())));

alter policy "Coaches view own client
  relationships" on public.coach_clients
  USING ((((select auth.uid()) = coach_id) OR ((select auth.uid()) = client_id)));

alter policy "coaches manage own how-tos" on public.coach_exercise_how_tos
  USING (((select auth.uid()) = coach_id))
  WITH CHECK (((select auth.uid()) = coach_id));

alter policy "coaches manage own how_tos" on public.coach_exercise_how_tos
  USING (((select auth.uid()) = coach_id));

alter policy "Coach manages own exercise videos" on public.coach_exercise_videos
  USING (((select auth.uid()) = coach_id));

alter policy "coach_food_serves_client_read" on public.coach_food_serves
  USING ((coach_id IN ( SELECT coach_clients.coach_id
   FROM coach_clients
  WHERE ((coach_clients.client_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));

alter policy "coach_food_serves_delete" on public.coach_food_serves
  USING ((coach_id = (select auth.uid())));

alter policy "coach_food_serves_insert" on public.coach_food_serves
  WITH CHECK ((coach_id = (select auth.uid())));

alter policy "coach_food_serves_select" on public.coach_food_serves
  USING ((coach_id = (select auth.uid())));

alter policy "coach_food_serves_update" on public.coach_food_serves
  USING ((coach_id = (select auth.uid())));

alter policy "Coaches manage own invites" on public.coach_invites
  USING (((select auth.uid()) = coach_id))
  WITH CHECK (((select auth.uid()) = coach_id));

alter policy "Coach manages own message templates" on public.coach_message_templates
  USING ((coach_id = (select auth.uid())));

alter policy "coaches manage own notes" on public.coach_notes
  USING (((select auth.uid()) = coach_id));

alter policy "coach_manage_own_notification_prefs" on public.coach_notification_prefs
  USING ((coach_id = (select auth.uid())));

alter policy "Coach manages own plan templates" on public.coach_plan_templates
  USING (((select auth.uid()) = coach_id));

alter policy "Coach manages own folders" on public.coach_resource_folders
  USING ((coach_id = (select auth.uid())));

alter policy "Coach deletes own resources" on public.coach_resources
  USING ((coach_id = (select auth.uid())));

alter policy "Coach inserts own resources" on public.coach_resources
  WITH CHECK ((coach_id = (select auth.uid())));

alter policy "Coach reads own or global resources" on public.coach_resources
  USING (((coach_id = (select auth.uid())) OR (is_global = true)));

alter policy "Coach updates own resources" on public.coach_resources
  USING ((coach_id = (select auth.uid())));

alter policy "coach_manage_own_saved_workouts" on public.coach_saved_workouts
  USING ((coach_id = (select auth.uid())));

alter policy "Coach manages own services" on public.coach_services
  USING (((select auth.uid()) = coach_id))
  WITH CHECK (((select auth.uid()) = coach_id));

alter policy "coaches manage own services" on public.coach_services
  USING (((select auth.uid()) = coach_id));

alter policy "Anyone authenticated reads global or own supplements" on public.coach_supplements
  USING ((((select auth.uid()) IS NOT NULL) AND ((coach_id IS NULL) OR ((select auth.uid()) = coach_id))));

alter policy "Coach manages own supplements" on public.coach_supplements
  USING (((select auth.uid()) = coach_id));

alter policy "participants access conversations" on public.conversations
  USING ((((select auth.uid()) = coach_id) OR ((select auth.uid()) = client_id)));

alter policy "coach_read_custom_metric_logs" on public.custom_metric_logs
  USING ((EXISTS ( SELECT 1
   FROM coach_clients
  WHERE ((coach_clients.client_id = custom_metric_logs.user_id) AND (coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));

alter policy "owner_manage_custom_metric_logs" on public.custom_metric_logs
  USING ((user_id = (select auth.uid())));

alter policy "coach_read_custom_metrics" on public.custom_metrics
  USING ((EXISTS ( SELECT 1
   FROM coach_clients
  WHERE ((coach_clients.client_id = custom_metrics.user_id) AND (coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));

alter policy "owner_manage_custom_metrics" on public.custom_metrics
  USING ((user_id = (select auth.uid())));

alter policy "Users can manage own cycle logs" on public.cycle_logs
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

alter policy "Users manage own exercise sets" on public.exercise_sets
  USING ((workout_exercise_id IN ( SELECT we.id
   FROM (workout_exercises we
     JOIN workouts w ON ((we.workout_id = w.id)))
  WHERE (w.user_id = (select auth.uid())))));
