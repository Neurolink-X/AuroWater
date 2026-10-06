-- AuroTap — Customer profile settings
-- Migration: 011_profile_settings.sql
-- Safe to run more than once.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS settings JSONB
NOT NULL
DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.settings
IS 'Customer account preferences and notification settings';

SELECT pg_notify('pgrst', 'reload schema');
