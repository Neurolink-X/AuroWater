-- Extend existing supplier settings additively for registered service address.
BEGIN;
ALTER TABLE public.supplier_settings
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_settings_pincode_valid' AND conrelid = 'public.supplier_settings'::regclass) THEN
    ALTER TABLE public.supplier_settings
      ADD CONSTRAINT supplier_settings_pincode_valid CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$');
  END IF;
END $$;
COMMIT;
