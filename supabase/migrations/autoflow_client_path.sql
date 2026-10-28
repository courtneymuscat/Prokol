-- Client-chosen "path" within an autoflow (e.g. Plan & Swap / Track Serves /
-- Protein + Calories in the Foundations program). Lives on the flow
-- instance, not the profile — the path belongs to this particular
-- program, not the client permanently, and switching programs later
-- shouldn't carry an old path forward.
--
-- habit / tasks / protocol_section on autoflow_template_steps (already
-- jsonb) don't need a schema change to vary by path — the app resolves
-- either a flat value or a { ps, ts, pc } keyed object at read time.

alter table client_autoflows
  add column if not exists selected_path text;

alter table client_autoflows
  add constraint client_autoflows_selected_path_check
  check (selected_path is null or selected_path in ('ps', 'ts', 'pc'));
