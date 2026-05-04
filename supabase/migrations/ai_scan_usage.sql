-- Tracks AI meal scan usage per client per calendar month (50 scans/month limit)
CREATE TABLE IF NOT EXISTS public.ai_scan_usage (
  client_id  uuid  REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month_year text  NOT NULL, -- 'YYYY-MM', e.g. '2026-05'
  scan_count int   NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, month_year)
);

ALTER TABLE public.ai_scan_usage ENABLE ROW LEVEL SECURITY;

-- Client can read their own usage (shown in the food log UI)
CREATE POLICY "Client reads own scan usage" ON public.ai_scan_usage
  FOR SELECT USING (auth.uid() = client_id);

-- Service/admin role handles all writes (usage increments happen server-side)
CREATE POLICY "Service role manages scan usage" ON public.ai_scan_usage
  FOR ALL USING (true);
