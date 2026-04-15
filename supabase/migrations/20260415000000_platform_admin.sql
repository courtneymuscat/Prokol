-- ── Platform Admin Migration ────────────────────────────────────────────────
-- Adds platform_admin role, admin audit log, and suspension columns.

-- 1. Check the current role constraint and add platform_admin if needed
DO $$
BEGIN
  -- Drop the existing role check constraint if it exists (any name)
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'profiles'
    AND column_name = 'role'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'profiles'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%role%'
    )
  ) THEN
    -- Drop whatever role check exists
    EXECUTE (
      SELECT 'ALTER TABLE public.profiles DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'profiles'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%role%'
      LIMIT 1
    );
  END IF;
END $$;

-- Re-add with platform_admin included
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check CHECK (
  role = any (array[
    'coach'::text,
    'client'::text,
    'platform_admin'::text
  ])
);

-- 2. Set the platform owner (only coach_solo user) to platform_admin
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id
  FROM public.profiles
  WHERE user_type = 'coach'
    AND subscription_tier = 'coach_solo'
  LIMIT 1;

  IF admin_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'platform_admin'
    WHERE id = admin_id;
  END IF;
END $$;

-- 3. Add suspension columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_suspended boolean not null default false,
ADD COLUMN IF NOT EXISTS suspended_reason text null;

-- 4. Admin audit log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid not null default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  action text not null,
  target_user_id uuid null references auth.users(id),
  target_org_id uuid null references public.organisations(id),
  old_value text null,
  new_value text null,
  metadata jsonb null,
  created_at timestamp with time zone default now(),
  constraint admin_audit_log_pkey primary key (id)
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin only"
  ON public.admin_audit_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'platform_admin'
    )
  );
