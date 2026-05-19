-- One-time cleanup of stale 'pending_invite' rows in coach_clients.
--
-- An older code path used `upsert` with `onConflict: 'coach_id,client_id'`,
-- which silently inserts a duplicate row when there is no unique constraint
-- on (coach_id, client_id) — leading to the coach seeing the same client
-- twice (once as Pending, once as Active) after the client accepted.
--
-- This migration:
--   1) Deletes any 'pending_invite' rows where an 'active' (or 'archived')
--      row already exists for the same (coach_id, client_id) pair.
--   2) Adds a unique constraint to prevent the duplicate from recurring,
--      and so future upserts can rely on it.

BEGIN;

-- (1) Remove duplicate pending_invite rows
DELETE FROM coach_clients pending
USING coach_clients other
WHERE pending.status = 'pending_invite'
  AND other.coach_id = pending.coach_id
  AND other.client_id = pending.client_id
  AND other.id <> pending.id
  AND other.status IN ('active', 'archived');

-- (2) Add the unique constraint that the upsert logic expects.
-- Wrapped in a DO block so this migration is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_clients_coach_id_client_id_key'
  ) THEN
    ALTER TABLE coach_clients
      ADD CONSTRAINT coach_clients_coach_id_client_id_key
      UNIQUE (coach_id, client_id);
  END IF;
END $$;

COMMIT;
