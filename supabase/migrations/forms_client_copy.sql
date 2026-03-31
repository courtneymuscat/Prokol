-- Mark forms that are client-specific copies (not reusable templates)
ALTER TABLE forms ADD COLUMN IF NOT EXISTS is_client_copy boolean NOT NULL DEFAULT false;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
