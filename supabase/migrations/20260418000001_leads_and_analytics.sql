-- Leads table for admin CRM
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  source text DEFAULT 'other', -- 'instagram' | 'facebook' | 'referral' | 'website' | 'cold_outreach' | 'event' | 'other'
  status text NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'follow_up' | 'qualified' | 'won' | 'lost'
  notes text,
  follow_up_done boolean NOT NULL DEFAULT false,
  follow_up_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Only platform admins can access leads
CREATE POLICY "platform_admins_manage_leads" ON public.leads
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Track when clients are archived for churn analytics
ALTER TABLE public.coach_clients ADD COLUMN IF NOT EXISTS archived_at timestamptz;
