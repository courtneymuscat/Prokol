ALTER TABLE public.coach_clients ADD CONSTRAINT coach_clients_targets_source_check CHECK (targets_source IS NULL OR targets_source IN ('tdee', 'meal_plan', 'weekly_plan'));
