alter table client_meal_plans
  add column if not exists show_macros boolean not null default true;
