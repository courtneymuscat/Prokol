-- custom_domain has been optional at the application layer since every
-- approved org gets a free {slug}.prokol.io subdomain automatically — a
-- custom domain is an opt-in upgrade on top of that, not a requirement.
-- The column itself was never updated to match, so submitting an
-- application without a custom domain failed with a not-null violation.
ALTER TABLE public.white_label_applications
ALTER COLUMN custom_domain DROP NOT NULL;
