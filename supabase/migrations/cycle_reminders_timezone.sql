-- Add cycle_reminders opt-out flag and timezone to profiles
-- Run this in Supabase SQL editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cycle_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone text;
