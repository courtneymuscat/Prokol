ALTER TABLE autoflow_template_steps ADD COLUMN IF NOT EXISTS include_core_questions boolean NOT NULL DEFAULT true;
