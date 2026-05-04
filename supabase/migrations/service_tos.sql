-- Add terms of service URL to coach services
alter table coach_services
  add column if not exists tos_url text;
