-- Lets an individual (non-gym) signup link describe itself as a "course" —
-- a name and description independent of whichever autoflow(s) happen to
-- be attached to it. Needed once a link can bundle more than one autoflow
-- (see app/api/coach/program-links/route.ts): the sales landing page
-- (app/org/join/[code]/page.tsx) previously just showed the first
-- attached autoflow's own name, which doesn't represent a bundle.
--
-- Nullable and additive — existing single-autoflow links are unaffected,
-- the landing page falls back to that autoflow's own name when unset.

alter table org_signup_links
  add column if not exists name text,
  add column if not exists description text;
