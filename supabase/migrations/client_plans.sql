-- Plan builder: one active plan per client-coach pair, phases stored as JSONB
CREATE TABLE IF NOT EXISTS public.client_plans (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  coach_id    uuid        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name        text        NOT NULL DEFAULT 'Protocol',
  start_date  date,
  phases      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, coach_id)
);

ALTER TABLE public.client_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages client plan" ON public.client_plans
  FOR ALL USING (auth.uid() = coach_id);

CREATE POLICY "Client reads own plan" ON public.client_plans
  FOR SELECT USING (auth.uid() = client_id);

-- Reusable phase templates a coach can save and load into any client plan
CREATE TABLE IF NOT EXISTS public.coach_plan_templates (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    uuid        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name        text        NOT NULL,
  description text,
  phases      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own plan templates" ON public.coach_plan_templates
  FOR ALL USING (auth.uid() = coach_id);
