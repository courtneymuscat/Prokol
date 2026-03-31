-- ── Coaching Platform Migration ────────────────────────────────────────────
-- Run this in Supabase SQL Editor

-- Calendar events (coach-scheduled items per client per day)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_date date NOT NULL,
  type text NOT NULL DEFAULT 'note', -- 'workout' | 'note' | 'steps' | 'habit' | 'custom'
  title text NOT NULL,
  content jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages calendar events" ON public.calendar_events
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Client reads own calendar events" ON public.calendar_events
  FOR SELECT USING (auth.uid() = client_id);

-- Meal plan templates (coach library)
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  goal text NOT NULL DEFAULT 'maintain', -- 'cut' | 'build' | 'maintain'
  total_calories int NOT NULL DEFAULT 0,
  content jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages own meal plans" ON public.meal_plans
  FOR ALL USING (auth.uid() = coach_id);

-- Meal plans assigned to clients
CREATE TABLE IF NOT EXISTS public.client_meal_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_plan_id uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  content jsonb NOT NULL DEFAULT '[]',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.client_meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages client meal plans" ON public.client_meal_plans
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Client reads own meal plans" ON public.client_meal_plans
  FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Client updates own meal plans" ON public.client_meal_plans
  FOR UPDATE USING (auth.uid() = client_id);

-- Habits assigned by coach to client
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'daily',
  target numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'times',
  icon text NOT NULL DEFAULT '✓',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages habits" ON public.habits
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Client reads own habits" ON public.habits
  FOR SELECT USING (auth.uid() = client_id);

-- Client daily habit logs
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id uuid REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  value numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(habit_id, log_date)
);
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client manages own habit logs" ON public.habit_logs
  FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Coach reads client habit logs" ON public.habit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_id AND h.coach_id = auth.uid()
    )
  );
