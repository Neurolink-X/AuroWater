-- Faster autocomplete on the existing 165,627-row public India Post directory.
-- Keep the existing pincode btree index for exact PIN lookup.
-- The new index supports ILIKE '%office%' without repeated full-table scans.
-- Static imported reference data is read far more often than it is modified.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS pincode_directory_office_name_trgm_idx
  ON public.pincode_directory USING gin (office_name extensions.gin_trgm_ops);
ANALYZE public.pincode_directory;
