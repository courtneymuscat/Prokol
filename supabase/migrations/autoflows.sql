-- Autoflows: automated check-in and onboarding sequences
-- ────────────────────────────────────────────────────────

-- Coach-owned reusable templates
CREATE TABLE IF NOT EXISTS public.autoflow_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'weekly_checkin', -- 'weekly_checkin' | 'onboarding'
  total_steps int NOT NULL DEFAULT 12,
  core_questions jsonb NOT NULL DEFAULT '[]', -- questions shown on every step
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.autoflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages own autoflow templates" ON public.autoflow_templates
  FOR ALL USING (auth.uid() = coach_id);

-- Steps within a template (week 1–12, or onboarding day 0/3/7/14 etc.)
CREATE TABLE IF NOT EXISTS public.autoflow_template_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES public.autoflow_templates(id) ON DELETE CASCADE NOT NULL,
  step_number int NOT NULL,
  title text NOT NULL DEFAULT '',
  description text,
  questions jsonb NOT NULL DEFAULT '[]',
  day_offset int NOT NULL DEFAULT 0, -- days from flow start_date to send this step
  UNIQUE(template_id, step_number)
);
ALTER TABLE public.autoflow_template_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages own template steps" ON public.autoflow_template_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.autoflow_templates t
      WHERE t.id = template_id AND t.coach_id = auth.uid()
    )
  );

-- Assigned flow instances per client
CREATE TABLE IF NOT EXISTS public.client_autoflows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES public.autoflow_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'completed'
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.client_autoflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages client autoflows" ON public.client_autoflows
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Client reads own autoflows" ON public.client_autoflows
  FOR SELECT USING (auth.uid() = client_id);

-- Client-specific question overrides (never touches the template)
CREATE TABLE IF NOT EXISTS public.client_autoflow_step_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_autoflow_id uuid REFERENCES public.client_autoflows(id) ON DELETE CASCADE NOT NULL,
  step_number int NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]',
  UNIQUE(client_autoflow_id, step_number)
);
ALTER TABLE public.client_autoflow_step_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages step overrides" ON public.client_autoflow_step_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.client_autoflows f
      WHERE f.id = client_autoflow_id AND f.coach_id = auth.uid()
    )
  );
CREATE POLICY "Client reads own step overrides" ON public.client_autoflow_step_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_autoflows f
      WHERE f.id = client_autoflow_id AND f.client_id = auth.uid()
    )
  );

-- Client responses per step (one per step)
CREATE TABLE IF NOT EXISTS public.autoflow_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_autoflow_id uuid REFERENCES public.client_autoflows(id) ON DELETE CASCADE NOT NULL,
  step_number int NOT NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  submitted_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(client_autoflow_id, step_number)
);
ALTER TABLE public.autoflow_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client manages own autoflow responses" ON public.autoflow_responses
  FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Coach reads client autoflow responses" ON public.autoflow_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_autoflows f
      WHERE f.id = client_autoflow_id AND f.coach_id = auth.uid()
    )
  );
