-- Run in Supabase SQL Editor when PostgREST returns PGRST205 ("could not find the table in the schema cache")
-- after migrations, even though the table exists in Postgres. Safe, no data change.
NOTIFY pgrst, 'reload schema';
