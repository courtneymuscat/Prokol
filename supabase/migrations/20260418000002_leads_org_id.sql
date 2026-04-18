-- Scope leads to org (null = platform-admin leads, non-null = org business leads)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS leads_org_id_idx ON public.leads(org_id);
