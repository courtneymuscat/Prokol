-- Coach-managed medications list per client. Stored alongside the rest
-- of the goals/notes data so RLS and permissions piggyback on the
-- existing client_goals policies. Shape: [{ name: string, reason: string }]
ALTER TABLE public.client_goals
  ADD COLUMN IF NOT EXISTS medications jsonb DEFAULT '[]'::jsonb;
