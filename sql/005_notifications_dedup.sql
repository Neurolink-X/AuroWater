-- 005_notifications_dedup.sql
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedup_key text;

DROP INDEX IF EXISTS notifications_user_dedup_key_idx;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_key_idx
  ON public.notifications (dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Enable Realtime (run on Supabase Postgres; skip if tables are already in publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
