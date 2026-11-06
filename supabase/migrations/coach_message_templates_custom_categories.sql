ALTER TABLE coach_message_templates ADD COLUMN IF NOT EXISTS custom_categories jsonb NOT NULL DEFAULT '[]'::jsonb;
