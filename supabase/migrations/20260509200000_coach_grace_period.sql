-- Grace period for coaches removed from an organisation. While
-- coach_grace_until is in the future, the coach keeps their existing
-- coach_business access + clients. Once it expires, the next login or
-- dashboard load downgrades them to individual_free.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS coach_grace_until timestamptz null;
