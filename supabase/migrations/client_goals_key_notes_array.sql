alter table client_goals
  alter column key_notes type text[]
  using case when key_notes is null then '{}' else array[key_notes] end;

alter table client_goals alter column key_notes set default '{}';
