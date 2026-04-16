-- Extend organisations table for full white-label
ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS app_name text null,
ADD COLUMN IF NOT EXISTS brand_colour_secondary text null,
ADD COLUMN IF NOT EXISTS brand_colour_text text null,
ADD COLUMN IF NOT EXISTS favicon_url text null,
ADD COLUMN IF NOT EXISTS support_email text null,
ADD COLUMN IF NOT EXISTS custom_domain_verified boolean not null default false,
ADD COLUMN IF NOT EXISTS white_label_tier text null,
ADD COLUMN IF NOT EXISTS is_white_label boolean not null default false;

ALTER TABLE public.organisations
ADD CONSTRAINT organisations_white_label_tier_check
  CHECK (
    white_label_tier is null or
    white_label_tier = any (array[
      'starter'::text,
      'pro'::text
    ])
  );

-- White label applications table
CREATE TABLE IF NOT EXISTS public.white_label_applications (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  app_name text not null,
  custom_domain text not null,
  brand_colour text not null,
  brand_colour_secondary text null,
  logo_url text null,
  favicon_url text null,
  support_email text not null,
  requested_tier text not null default 'starter',
  status text not null default 'pending',
  submitted_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone null,
  reviewed_by uuid null references auth.users(id),
  rejection_reason text null,
  notes text null,
  constraint white_label_applications_pkey primary key (id),
  constraint white_label_applications_status_check check (
    status = any (array[
      'pending'::text,
      'approved'::text,
      'rejected'::text
    ])
  )
);

ALTER TABLE public.white_label_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org owner can manage own application"
  ON public.white_label_applications FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid()
      AND org_id IS NOT NULL
    )
  );

CREATE POLICY "platform admin can manage all applications"
  ON public.white_label_applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'platform_admin'
    )
  );
