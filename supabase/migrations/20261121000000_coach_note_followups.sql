-- Follow-up reminders on coach notes.
--
-- Coaches often reply to a flagged check-in and want to circle back weeks
-- later to see how it landed. Rather than a separate reminders table that
-- would duplicate most of coach_notes (and force writing the same thing
-- twice), the note itself carries an optional due date.
--
-- source_label/source_url are denormalised on purpose: the follow-ups list
-- spans every client, so storing the display text and deep link avoids
-- joining across autoflow_responses, form_submissions and check_ins just to
-- render a row. A note whose source is later deleted keeps a readable label
-- and simply links to a check-in that no longer exists.

alter table public.coach_notes
  add column if not exists follow_up_date  date,
  add column if not exists follow_up_done  boolean not null default false,
  add column if not exists source_label    text,
  add column if not exists source_url      text;

-- The follow-ups view is "mine, still outstanding, soonest first" — this
-- index serves exactly that.
create index if not exists coach_notes_follow_up_idx
  on public.coach_notes (coach_id, follow_up_date)
  where follow_up_date is not null and follow_up_done = false;
