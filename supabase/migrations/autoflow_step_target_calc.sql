-- Autoflow step → target calculator + auto meal-plan assignment
-- ────────────────────────────────────────────────────────
-- Lets a coach attach a client-facing TDEE/macro calculator to an
-- autoflow step (e.g. the first lesson of a program). Unlike habit/
-- program_link, this isn't a silent background auto-fire — the client has
-- to actually use the calculator widget, since the required inputs
-- (age/sex/height/weight/activity) may not exist on their profile yet.
-- See app/api/client/autoflows/[flowId]/[step]/calculate-targets/route.ts.
--
-- Once the client submits, their calculated target is saved as their
-- real daily target (same as a coach manually saving the TDEE card), and
-- — only if they don't already have an active meal plan — the closest-
-- matching plan from the coach's own meal_plans library is auto-assigned
-- as a starting point (same "fork a template into a real per-client row"
-- pattern as autoSetupForSignupLinkClient in
-- app/api/onboarding/complete/route.ts, which this mirrors closely).

alter table autoflow_template_steps
  add column if not exists target_calc jsonb;  -- { note: string | null } | null

-- Tracks that this client has already run the calculator for this step
-- (so it only ever assigns a meal plan once per step, and the widget can
-- show a "done" state instead of the form again), and which meal plan (if
-- any) ended up assigned as a result.
create table if not exists autoflow_step_nutrition_instances (
  id uuid primary key default gen_random_uuid(),
  client_autoflow_id uuid references client_autoflows(id) on delete cascade not null,
  step_number int not null,
  client_id uuid references profiles(id) on delete cascade not null,
  client_meal_plan_id uuid references client_meal_plans(id) on delete set null,
  target_calories int,
  target_protein int,
  target_carbs int,
  target_fat int,
  created_at timestamptz default now() not null,
  unique(client_autoflow_id, step_number)
);

alter table autoflow_step_nutrition_instances enable row level security;

create policy "Coach manages step nutrition instances" on autoflow_step_nutrition_instances
  for all using (
    exists (
      select 1 from client_autoflows f
      where f.id = client_autoflow_id and f.coach_id = auth.uid()
    )
  );

create policy "Client reads own step nutrition instances" on autoflow_step_nutrition_instances
  for select using (
    exists (
      select 1 from client_autoflows f
      where f.id = client_autoflow_id and f.client_id = auth.uid()
    )
  );
