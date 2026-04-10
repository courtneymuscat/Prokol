-- ── Coach Resource Library ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coach_resource_folders (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT 'blue',
  icon        text NOT NULL DEFAULT '📁',
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE coach_resource_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach manages own folders" ON coach_resource_folders;
CREATE POLICY "Coach manages own folders" ON coach_resource_folders FOR ALL USING (coach_id = auth.uid());

CREATE TABLE IF NOT EXISTS coach_resources (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  folder_id   uuid REFERENCES coach_resource_folders(id) ON DELETE SET NULL,
  name        text NOT NULL,
  description text,
  type        text NOT NULL DEFAULT 'link', -- 'link' | 'video' | 'pdf' | 'document'
  url         text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE coach_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach manages own resources" ON coach_resources;
CREATE POLICY "Coach manages own resources" ON coach_resources FOR ALL USING (coach_id = auth.uid());

-- Coaches assign specific resources to specific clients
CREATE TABLE IF NOT EXISTS client_resource_access (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES coach_resources(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(resource_id, client_id)
);

ALTER TABLE client_resource_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach manages client resource access" ON client_resource_access;
DROP POLICY IF EXISTS "Client reads own resource access" ON client_resource_access;
CREATE POLICY "Coach manages client resource access" ON client_resource_access FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "Client reads own resource access" ON client_resource_access FOR SELECT USING (client_id = auth.uid());

-- ── Autoflow step attachments ────────────────────────────────────────────────
-- resource_ids : array of coach_resources IDs to show client in this step
-- form_id      : optional form for client to fill out
-- tasks        : [{id, label}] simple checklist items

ALTER TABLE autoflow_template_steps
  ADD COLUMN IF NOT EXISTS resource_ids jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS form_id      uuid  REFERENCES forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tasks        jsonb NOT NULL DEFAULT '[]';
