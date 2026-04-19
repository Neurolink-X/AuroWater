-- 005_notifications_dedup.sql
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedup_key text;

DROP INDEX IF EXISTS notifications_user_dedup_key_idx;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_key_idx
  ON public.notifications (dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Enable Realtime (run on Supabase Postgres; skip if tables are already in publication)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
