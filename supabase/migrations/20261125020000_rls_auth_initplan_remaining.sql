-- Evaluate auth.uid()/auth.role() once per query instead of once per row.
--
-- Completes 20261125010000, which covered only the first 100 policies — the
-- listing it was built from was capped at 100 rows and stopped alphabetically
-- at exercise_sets, leaving food_logs, profiles, messages and workouts
-- untouched. This covers all 184 policies that call an auth helper.
--
-- Expressions are unwrapped before being re-wrapped, so the policies already
-- altered by the earlier migration end up with exactly one subquery rather
-- than a nested one, and re-running this is a no-op.
--
-- ALTER POLICY rather than DROP/CREATE: only the expression changes, each
-- policy keeps its command and roles, and no table is ever left unprotected.

alter policy "platform admin only" on public.admin_audit_log using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "Client reads own flags" on public.autoflow_response_flags using ((client_id = (select auth.uid())));
alter policy "Coach manages own client flags" on public.autoflow_response_flags using ((coach_id = (select auth.uid())));
alter policy "Client manages own autoflow responses" on public.autoflow_responses using (((select auth.uid()) = client_id));
alter policy "Coach reads client autoflow responses" on public.autoflow_responses using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_responses.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));
alter policy "Client manages own dismissals" on public.autoflow_step_dismissals using (((select auth.uid()) = client_id));
alter policy "Coach reads client dismissals" on public.autoflow_step_dismissals using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_dismissals.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));
alter policy "Client reads own step habit instances" on public.autoflow_step_habit_instances using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_habit_instances.client_autoflow_id) AND (f.client_id = (select auth.uid()))))));
alter policy "Coach manages step habit instances" on public.autoflow_step_habit_instances using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_habit_instances.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));
alter policy "Client reads own step nutrition instances" on public.autoflow_step_nutrition_instances using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_nutrition_instances.client_autoflow_id) AND (f.client_id = (select auth.uid()))))));
alter policy "Coach manages step nutrition instances" on public.autoflow_step_nutrition_instances using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_nutrition_instances.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));
alter policy "Client reads own step program instances" on public.autoflow_step_program_instances using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_program_instances.client_autoflow_id) AND (f.client_id = (select auth.uid()))))));
alter policy "Coach manages step program instances" on public.autoflow_step_program_instances using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = autoflow_step_program_instances.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));
alter policy "Coach manages own template steps" on public.autoflow_template_steps using ((EXISTS ( SELECT 1
   FROM autoflow_templates t
  WHERE ((t.id = autoflow_template_steps.template_id) AND (t.coach_id = (select auth.uid()))))));
alter policy "Coach manages own autoflow templates" on public.autoflow_templates using (((select auth.uid()) = coach_id));
alter policy "Clients read their coach's booking services" on public.booking_services using ((EXISTS ( SELECT 1
   FROM coach_clients cc
  WHERE ((cc.coach_id = booking_services.coach_id) AND (cc.client_id = (select auth.uid())) AND (cc.status = 'active'::text)))));
alter policy "Coach manages own booking services" on public.booking_services using (((select auth.uid()) = coach_id));
alter policy "Client reads own bookings" on public.bookings using (((select auth.uid()) = client_id));
alter policy "Coach manages own bookings" on public.bookings using (((select auth.uid()) = coach_id));
alter policy "Client reads own calendar events" on public.calendar_events using (((select auth.uid()) = client_id));
alter policy "Coach manages calendar events" on public.calendar_events using (((select auth.uid()) = coach_id));
alter policy cheat_sheet_foods_read on public.cheat_sheet_foods using (((select auth.role()) = 'authenticated'::text));
alter policy "Users manage own check-ins" on public.check_ins using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "client inserts own checkin answers" on public.checkin_answers with check ((checkin_id IN ( SELECT checkins.id
   FROM checkins
  WHERE (checkins.client_id = (select auth.uid())))));
alter policy "client reads own checkin answers" on public.checkin_answers using ((checkin_id IN ( SELECT checkins.id
   FROM checkins
  WHERE (checkins.client_id = (select auth.uid())))));
alter policy "coach reads client checkin answers" on public.checkin_answers using ((checkin_id IN ( SELECT checkins.id
   FROM checkins
  WHERE (checkins.client_id IN ( SELECT coach_clients.client_id
           FROM coach_clients
          WHERE ((coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))))));
alter policy "client reads assigned checkin forms" on public.checkin_forms using ((id IN ( SELECT checkin_schedules.form_id
   FROM checkin_schedules
  WHERE (checkin_schedules.client_id = (select auth.uid())))));
alter policy "coach manages own checkin forms" on public.checkin_forms using ((coach_id = (select auth.uid())));
alter policy "client reads questions in assigned forms" on public.checkin_questions using ((form_id IN ( SELECT checkin_schedules.form_id
   FROM checkin_schedules
  WHERE (checkin_schedules.client_id = (select auth.uid())))));
alter policy "coach manages own checkin questions" on public.checkin_questions using ((form_id IN ( SELECT checkin_forms.id
   FROM checkin_forms
  WHERE (checkin_forms.coach_id = (select auth.uid())))));
alter policy client_view_checkin_schedules on public.checkin_schedules using (((client_id = (select auth.uid())) AND (is_active = true)));
alter policy coach_manage_checkin_schedules on public.checkin_schedules using ((coach_id = (select auth.uid())));
alter policy "client manages own checkins" on public.checkins using ((client_id = (select auth.uid())));
alter policy "coach reads client checkins" on public.checkins using ((client_id IN ( SELECT coach_clients.client_id
   FROM coach_clients
  WHERE ((coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));
alter policy "Client reads own step overrides" on public.client_autoflow_step_overrides using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = client_autoflow_step_overrides.client_autoflow_id) AND (f.client_id = (select auth.uid()))))));
alter policy "Coach manages step overrides" on public.client_autoflow_step_overrides using ((EXISTS ( SELECT 1
   FROM client_autoflows f
  WHERE ((f.id = client_autoflow_step_overrides.client_autoflow_id) AND (f.coach_id = (select auth.uid()))))));
alter policy "Client reads own autoflows" on public.client_autoflows using (((select auth.uid()) = client_id));
alter policy "Coach manages client autoflows" on public.client_autoflows using (((select auth.uid()) = coach_id));
alter policy "client reads own files" on public.client_files using ((client_id = (select auth.uid())));
alter policy "coach manages client files" on public.client_files using ((coach_id = (select auth.uid())));
alter policy client_read_goals on public.client_goals using ((client_id = (select auth.uid())));
alter policy coach_manage_goals on public.client_goals using ((coach_id = (select auth.uid())));
alter policy "Client reads own meal plans" on public.client_meal_plans using (((select auth.uid()) = client_id));
alter policy "Client updates own meal plans" on public.client_meal_plans using (((select auth.uid()) = client_id));
alter policy "Coach manages client meal plans" on public.client_meal_plans using (((select auth.uid()) = coach_id));
alter policy "Client reads own plan" on public.client_plans using (((select auth.uid()) = client_id));
alter policy "Coach manages client plan" on public.client_plans using (((select auth.uid()) = coach_id));
alter policy "Client reads own programs" on public.client_programs using (((select auth.uid()) = client_id));
alter policy "Coach manages client programs" on public.client_programs using (((select auth.uid()) = coach_id));
alter policy "Client reads own protocol" on public.client_protocol using (((select auth.uid()) = client_id));
alter policy "Coach manages client protocol" on public.client_protocol using (((select auth.uid()) = coach_id));
alter policy "client manages own recipe ingredients" on public.client_recipe_ingredients using ((EXISTS ( SELECT 1
   FROM client_recipes
  WHERE ((client_recipes.id = client_recipe_ingredients.recipe_id) AND (client_recipes.user_id = (select auth.uid()))))));
alter policy "client manages own recipes" on public.client_recipes using ((user_id = (select auth.uid())));
alter policy "Client reads own resource access" on public.client_resource_access using ((client_id = (select auth.uid())));
alter policy "Coach manages client resource access" on public.client_resource_access using ((coach_id = (select auth.uid())));
alter policy serve_targets_client_read on public.client_serve_targets using ((client_id = (select auth.uid())));
alter policy serve_targets_coach on public.client_serve_targets using ((coach_id = (select auth.uid())));
alter policy "Client reads own supplements" on public.client_supplements using (((select auth.uid()) = client_id));
alter policy "Coach manages client supplements" on public.client_supplements using (((select auth.uid()) = coach_id));
alter policy "Coach manages own tag assignments" on public.client_tag_assignments using ((coach_id = (select auth.uid())));
alter policy "Coach manages own tags" on public.client_tags using ((coach_id = (select auth.uid())));
alter policy "Clients read their coach's availability" on public.coach_availability using ((EXISTS ( SELECT 1
   FROM coach_clients cc
  WHERE ((cc.coach_id = coach_availability.coach_id) AND (cc.client_id = (select auth.uid())) AND (cc.status = 'active'::text)))));
alter policy "Coach manages own availability" on public.coach_availability using (((select auth.uid()) = coach_id));
alter policy coach_cheat_sheet_delete on public.coach_cheat_sheet using ((coach_id = (select auth.uid())));
alter policy coach_cheat_sheet_insert on public.coach_cheat_sheet with check ((coach_id = (select auth.uid())));
alter policy coach_cheat_sheet_select on public.coach_cheat_sheet using ((coach_id = (select auth.uid())));
alter policy coach_cheat_sheet_update on public.coach_cheat_sheet using ((coach_id = (select auth.uid())));
alter policy "Clients can view and leave their own relationships" on public.coach_clients using ((client_id = (select auth.uid())));
alter policy "Coaches can manage their client relationships" on public.coach_clients using ((coach_id = (select auth.uid())));
alter policy "Coaches view own client
  relationships" on public.coach_clients using ((((select auth.uid()) = coach_id) OR ((select auth.uid()) = client_id)));
alter policy "coaches manage own how-tos" on public.coach_exercise_how_tos using (((select auth.uid()) = coach_id)) with check (((select auth.uid()) = coach_id));
alter policy "coaches manage own how_tos" on public.coach_exercise_how_tos using (((select auth.uid()) = coach_id));
alter policy "Coach manages own exercise videos" on public.coach_exercise_videos using (((select auth.uid()) = coach_id));
alter policy coach_food_serves_client_read on public.coach_food_serves using ((coach_id IN ( SELECT coach_clients.coach_id
   FROM coach_clients
  WHERE ((coach_clients.client_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));
alter policy coach_food_serves_delete on public.coach_food_serves using ((coach_id = (select auth.uid())));
alter policy coach_food_serves_insert on public.coach_food_serves with check ((coach_id = (select auth.uid())));
alter policy coach_food_serves_select on public.coach_food_serves using ((coach_id = (select auth.uid())));
alter policy coach_food_serves_update on public.coach_food_serves using ((coach_id = (select auth.uid())));
alter policy "Coaches manage own invites" on public.coach_invites using (((select auth.uid()) = coach_id)) with check (((select auth.uid()) = coach_id));
alter policy "Coach manages own message templates" on public.coach_message_templates using ((coach_id = (select auth.uid())));
alter policy "coaches manage own notes" on public.coach_notes using (((select auth.uid()) = coach_id));
alter policy coach_manage_own_notification_prefs on public.coach_notification_prefs using ((coach_id = (select auth.uid())));
alter policy "Coach manages own plan templates" on public.coach_plan_templates using (((select auth.uid()) = coach_id));
alter policy "Coach manages own folders" on public.coach_resource_folders using ((coach_id = (select auth.uid())));
alter policy "Coach deletes own resources" on public.coach_resources using ((coach_id = (select auth.uid())));
alter policy "Coach inserts own resources" on public.coach_resources with check ((coach_id = (select auth.uid())));
alter policy "Coach reads own or global resources" on public.coach_resources using (((coach_id = (select auth.uid())) OR (is_global = true)));
alter policy "Coach updates own resources" on public.coach_resources using ((coach_id = (select auth.uid())));
alter policy coach_manage_own_saved_workouts on public.coach_saved_workouts using ((coach_id = (select auth.uid())));
alter policy "Coach manages own services" on public.coach_services using (((select auth.uid()) = coach_id)) with check (((select auth.uid()) = coach_id));
alter policy "coaches manage own services" on public.coach_services using (((select auth.uid()) = coach_id));
alter policy "Anyone authenticated reads global or own supplements" on public.coach_supplements using ((((select auth.uid()) IS NOT NULL) AND ((coach_id IS NULL) OR ((select auth.uid()) = coach_id))));
alter policy "Coach manages own supplements" on public.coach_supplements using (((select auth.uid()) = coach_id));
alter policy "participants access conversations" on public.conversations using ((((select auth.uid()) = coach_id) OR ((select auth.uid()) = client_id)));
alter policy coach_read_custom_metric_logs on public.custom_metric_logs using ((EXISTS ( SELECT 1
   FROM coach_clients
  WHERE ((coach_clients.client_id = custom_metric_logs.user_id) AND (coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));
alter policy owner_manage_custom_metric_logs on public.custom_metric_logs using ((user_id = (select auth.uid())));
alter policy coach_read_custom_metrics on public.custom_metrics using ((EXISTS ( SELECT 1
   FROM coach_clients
  WHERE ((coach_clients.client_id = custom_metrics.user_id) AND (coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));
alter policy owner_manage_custom_metrics on public.custom_metrics using ((user_id = (select auth.uid())));
alter policy "Users can manage own cycle logs" on public.cycle_logs using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "Users manage own exercise sets" on public.exercise_sets using ((workout_exercise_id IN ( SELECT we.id
   FROM (workout_exercises we
     JOIN workouts w ON ((we.workout_id = w.id)))
  WHERE (w.user_id = (select auth.uid())))));
alter policy "Users can create custom exercises" on public.exercises with check (((is_custom = true) AND ((select auth.uid()) = created_by)));
alter policy "Authenticated users can insert foods" on public.food_database with check (((select auth.role()) = 'authenticated'::text));
alter policy "Users can delete own food logs" on public.food_logs using (((select auth.uid()) = user_id));
alter policy "Users can insert own food logs" on public.food_logs with check (((select auth.uid()) = user_id));
alter policy "Users can read own food logs" on public.food_logs using (((select auth.uid()) = user_id));
alter policy "Users manage own food logs" on public.food_logs using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "authenticated users can insert foods" on public.foods with check (((select auth.uid()) IS NOT NULL));
alter policy "client inserts own form answers" on public.form_answers with check ((submission_id IN ( SELECT form_submissions.id
   FROM form_submissions
  WHERE (form_submissions.client_id = (select auth.uid())))));
alter policy "client reads own form answers" on public.form_answers using ((submission_id IN ( SELECT form_submissions.id
   FROM form_submissions
  WHERE (form_submissions.client_id = (select auth.uid())))));
alter policy "coach reads client form answers" on public.form_answers using ((submission_id IN ( SELECT form_submissions.id
   FROM form_submissions
  WHERE (form_submissions.coach_id = (select auth.uid())))));
alter policy "Coaches can delete form questions" on public.form_questions using ((form_id IN ( SELECT forms.id
   FROM forms
  WHERE (forms.coach_id = (select auth.uid())))));
alter policy "Coaches can insert form questions" on public.form_questions with check ((form_id IN ( SELECT forms.id
   FROM forms
  WHERE (forms.coach_id = (select auth.uid())))));
alter policy "Coaches can select form questions" on public.form_questions using ((form_id IN ( SELECT forms.id
   FROM forms
  WHERE (forms.coach_id = (select auth.uid())))));
alter policy "Coaches can update form questions" on public.form_questions using ((form_id IN ( SELECT forms.id
   FROM forms
  WHERE (forms.coach_id = (select auth.uid())))));
alter policy "client inserts own submissions" on public.form_submissions with check ((client_id = (select auth.uid())));
alter policy "client reads own submissions" on public.form_submissions using ((client_id = (select auth.uid())));
alter policy "coach manages client submissions" on public.form_submissions using ((coach_id = (select auth.uid())));
alter policy "Coaches can delete their forms" on public.forms using ((coach_id = (select auth.uid())));
alter policy "Coaches can insert forms" on public.forms with check ((coach_id = (select auth.uid())));
alter policy "Coaches can select their forms" on public.forms using ((coach_id = (select auth.uid())));
alter policy "Coaches can update their forms" on public.forms using ((coach_id = (select auth.uid())));
alter policy "Client manages own habit logs" on public.habit_logs using (((select auth.uid()) = client_id));
alter policy "Coach reads client habit logs" on public.habit_logs using ((EXISTS ( SELECT 1
   FROM habits h
  WHERE ((h.id = habit_logs.habit_id) AND (h.coach_id = (select auth.uid()))))));
alter policy "Client reads own habits" on public.habits using (((select auth.uid()) = client_id));
alter policy "Coach manages habits" on public.habits using (((select auth.uid()) = coach_id));
alter policy platform_admins_manage_leads on public.leads using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "coach can view own master template grants" on public.master_template_coach_access using ((coach_id = (select auth.uid())));
alter policy "platform admin manages master template coach access" on public.master_template_coach_access using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "org members can view publications to their org" on public.master_template_publications using ((org_id IN ( SELECT profiles.org_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.org_id IS NOT NULL)))));
alter policy "platform admin manages publications" on public.master_template_publications using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "Users access own meal items" on public.meal_items using ((meal_id IN ( SELECT meals.id
   FROM meals
  WHERE (meals.user_id = (select auth.uid())))));
alter policy "Users can read own meal items" on public.meal_items using ((meal_id IN ( SELECT meals.id
   FROM meals
  WHERE (meals.user_id = (select auth.uid())))));
alter policy "Users manage own meal notes" on public.meal_notes using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "Coach manages own meal plans" on public.meal_plans using (((select auth.uid()) = coach_id));
alter policy "Users can read own meals" on public.meals using (((select auth.uid()) = user_id));
alter policy "Users manage own meals" on public.meals using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "participants access messages" on public.messages using ((conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE ((conversations.coach_id = (select auth.uid())) OR (conversations.client_id = (select auth.uid()))))));
alter policy coach_manage_note_templates on public.note_templates using ((coach_id = (select auth.uid())));
alter policy "coach reads client onboarding answers" on public.onboarding_answers using ((response_id IN ( SELECT onboarding_responses.id
   FROM onboarding_responses
  WHERE (onboarding_responses.client_id IN ( SELECT coach_clients.client_id
           FROM coach_clients
          WHERE ((coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))))));
alter policy "user manages own onboarding answers" on public.onboarding_answers using ((response_id IN ( SELECT onboarding_responses.id
   FROM onboarding_responses
  WHERE (onboarding_responses.client_id = (select auth.uid())))));
alter policy "coach manages own onboarding forms" on public.onboarding_forms using ((coach_id = (select auth.uid())));
alter policy "coach manages own onboarding questions" on public.onboarding_questions using ((form_id IN ( SELECT onboarding_forms.id
   FROM onboarding_forms
  WHERE (onboarding_forms.coach_id = (select auth.uid())))));
alter policy "coach reads client onboarding responses" on public.onboarding_responses using ((client_id IN ( SELECT coach_clients.client_id
   FROM coach_clients
  WHERE ((coach_clients.coach_id = (select auth.uid())) AND (coach_clients.status = 'active'::text)))));
alter policy "user manages own onboarding responses" on public.onboarding_responses using ((client_id = (select auth.uid())));
alter policy "Org members read announcements" on public.org_announcements using (((archived_at IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.org_id = org_announcements.org_id))))));
alter policy "Org owner manages announcements" on public.org_announcements using ((EXISTS ( SELECT 1
   FROM organisations o
  WHERE ((o.id = org_announcements.org_id) AND (o.owner_id = (select auth.uid()))))));
alter policy "org members can view assignment history" on public.org_client_assignments using ((org_id IN ( SELECT org_members.org_id
   FROM org_members
  WHERE ((org_members.user_id = (select auth.uid())) AND (org_members.is_active = true)))));
alter policy "org owner and admin can assign clients" on public.org_client_assignments with check ((org_id IN ( SELECT org_members.org_id
   FROM org_members
  WHERE ((org_members.user_id = (select auth.uid())) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (org_members.is_active = true)))));
alter policy "coaches can view own permissions" on public.org_coach_permissions using ((coach_id = (select auth.uid())));
alter policy "org owner and admin can manage permissions" on public.org_coach_permissions using ((org_id IN ( SELECT org_members.org_id
   FROM org_members
  WHERE ((org_members.user_id = (select auth.uid())) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (org_members.is_active = true)))));
alter policy "org owner and admin can manage invites" on public.org_invites using ((org_id IN ( SELECT org_members.org_id
   FROM org_members
  WHERE ((org_members.user_id = (select auth.uid())) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (org_members.is_active = true)))));
alter policy "org members can view teammates" on public.org_members using ((org_id IN ( SELECT profiles.org_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.org_id IS NOT NULL)))));
alter policy "org owner and admin can manage members" on public.org_members using ((org_id IN ( SELECT org_members_1.org_id
   FROM org_members org_members_1
  WHERE ((org_members_1.user_id = (select auth.uid())) AND (org_members_1.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (org_members_1.is_active = true)))));
alter policy "platform admin manages signup link autoflows" on public.org_signup_link_autoflows using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "platform admin manages signup link purchases" on public.org_signup_link_purchases using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "platform admin manages signup links" on public.org_signup_links using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "org admins can manage template exclusions" on public.org_template_exclusions using ((org_id IN ( SELECT org_members.org_id
   FROM org_members
  WHERE ((org_members.user_id = (select auth.uid())) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (org_members.is_active = true)))));
alter policy "org members can view their org" on public.organisations using ((id IN ( SELECT profiles.org_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.org_id IS NOT NULL)))));
alter policy "org owner can update" on public.organisations using ((owner_id = (select auth.uid())));
alter policy "platform admin full access" on public.organisations using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "Coach can read client profiles" on public.profiles using ((EXISTS ( SELECT 1
   FROM coach_clients
  WHERE ((coach_clients.coach_id = (select auth.uid())) AND (coach_clients.client_id = profiles.id) AND (coach_clients.status = ANY (ARRAY['active'::text, 'archived'::text]))))));
alter policy "Users manage own profile" on public.profiles using (((select auth.uid()) = id)) with check (((select auth.uid()) = id));
alter policy "coaches can read client profiles" on public.profiles using (((id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM coach_clients
  WHERE ((coach_clients.coach_id = (select auth.uid())) AND (coach_clients.client_id = profiles.id) AND (coach_clients.status = 'active'::text))))));
alter policy "Coach manages own programs" on public.programs using (((select auth.uid()) = coach_id));
alter policy "Users manage own progress photos" on public.progress_photos using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "users manage own subscriptions" on public.push_subscriptions using (((select auth.uid()) = user_id));
alter policy recipe_ingredients_delete on public.recipe_ingredients using ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_ingredients.recipe_id) AND (r.coach_id = (select auth.uid()))))));
alter policy recipe_ingredients_insert on public.recipe_ingredients with check ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_ingredients.recipe_id) AND (r.coach_id = (select auth.uid()))))));
alter policy recipe_ingredients_select on public.recipe_ingredients using ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_ingredients.recipe_id) AND ((r.coach_id = (select auth.uid())) OR (r.is_global = true))))));
alter policy recipe_ingredients_update on public.recipe_ingredients using ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_ingredients.recipe_id) AND (r.coach_id = (select auth.uid()))))));
alter policy recipe_modifications_delete on public.recipe_modifications using ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_modifications.recipe_id) AND (r.coach_id = (select auth.uid()))))));
alter policy recipe_modifications_insert on public.recipe_modifications with check ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_modifications.recipe_id) AND (r.coach_id = (select auth.uid()))))));
alter policy recipe_modifications_select on public.recipe_modifications using ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_modifications.recipe_id) AND ((r.coach_id = (select auth.uid())) OR (r.is_global = true))))));
alter policy recipe_modifications_update on public.recipe_modifications using ((EXISTS ( SELECT 1
   FROM recipes r
  WHERE ((r.id = recipe_modifications.recipe_id) AND (r.coach_id = (select auth.uid()))))));
alter policy recipes_delete on public.recipes using ((coach_id = (select auth.uid())));
alter policy recipes_insert on public.recipes with check ((coach_id = (select auth.uid())));
alter policy recipes_select on public.recipes using (((coach_id = (select auth.uid())) OR (is_global = true)));
alter policy recipes_update on public.recipes using ((coach_id = (select auth.uid())));
alter policy "user manages own food history" on public.user_food_history using ((user_id = (select auth.uid())));
alter policy "Users manage own weight logs" on public.weight_logs using (((select auth.uid()) = user_id)) with check (((select auth.uid()) = user_id));
alter policy "org owner can manage own application" on public.white_label_applications using ((org_id IN ( SELECT profiles.org_id
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.org_id IS NOT NULL)))));
alter policy "platform admin can manage all applications" on public.white_label_applications using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::text)))));
alter policy "Users manage own workout exercises" on public.workout_exercises using ((workout_id IN ( SELECT workouts.id
   FROM workouts
  WHERE (workouts.user_id = (select auth.uid())))));
alter policy "Users manage own workouts" on public.workouts using (((select auth.uid()) = user_id));
