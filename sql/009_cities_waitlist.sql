-- Cities catalogue + city_waitlist (demand capture)
-- RLS uses public.profiles (not user_profiles)

CREATE TABLE IF NOT EXISTS public.cities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  state         TEXT NOT NULL DEFAULT 'Uttar Pradesh',
  slug          TEXT NOT NULL UNIQUE,
  lat           NUMERIC(10,7) NOT NULL,
  lng           NUMERIC(10,7) NOT NULL,
  radius_km     INTEGER NOT NULL DEFAULT 25,
  status        TEXT NOT NULL DEFAULT 'waitlist'
                  CHECK (status IN ('active', 'coming_soon', 'waitlist')),
  sort_order    INTEGER DEFAULT 99,
  is_featured   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.cities (name, slug, lat, lng, radius_km, status, sort_order, is_featured) VALUES
  ('Gorakhpur', 'gorakhpur', 26.7606, 83.3732, 25, 'active',      1, true),
  ('Kanpur',    'kanpur',    26.4499, 80.3319, 30, 'active',      2, true),
  ('Lucknow',   'lucknow',   26.8467, 80.9462, 30, 'active',      3, true),
  ('Varanasi',  'varanasi',  25.3176, 82.9739, 20, 'coming_soon', 4, true),
  ('Agra',      'agra',      27.1767, 78.0081, 20, 'coming_soon', 5, false),
  ('Prayagraj', 'prayagraj', 25.4358, 81.8463, 20, 'waitlist',    6, false),
  ('Meerut',    'meerut',    28.9845, 77.7064, 20, 'waitlist',    7, false),
  ('Mathura',   'mathura',   27.4924, 77.6737, 15, 'waitlist',    8, false),
  ('Bareilly',  'bareilly',  28.3670, 79.4304, 15, 'waitlist',    9, false),
  ('Aligarh',   'aligarh',   27.8974, 78.0880, 15, 'waitlist',   10, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius_km = EXCLUDED.radius_km,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  is_featured = EXCLUDED.is_featured;

CREATE TABLE IF NOT EXISTS public.city_waitlist (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id        UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  custom_city    TEXT,
  custom_state   TEXT,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT,
  role           TEXT NOT NULL DEFAULT 'customer'
                   CHECK (role IN ('customer', 'seller', 'agent')),
  business_name  TEXT,
  message         TEXT,
  lat            NUMERIC(10,7),
  lng            NUMERIC(10,7),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'notified', 'converted', 'dismissed')),
  source         TEXT DEFAULT 'register',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_city_id ON public.city_waitlist(city_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_role ON public.city_waitlist(role);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.city_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON public.city_waitlist(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cities_status ON public.cities(status);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cities_public_read ON public.cities;
CREATE POLICY cities_public_read ON public.cities FOR SELECT USING (true);

DROP POLICY IF EXISTS admin_manage_cities ON public.cities;
CREATE POLICY admin_manage_cities ON public.cities FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS waitlist_insert_public ON public.city_waitlist;
CREATE POLICY waitlist_insert_public ON public.city_waitlist
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS admin_read_waitlist ON public.city_waitlist;
CREATE POLICY admin_read_waitlist ON public.city_waitlist FOR SELECT TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS admin_update_waitlist ON public.city_waitlist;
CREATE POLICY admin_update_waitlist ON public.city_waitlist FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

SELECT pg_notify('pgrst', 'reload schema');
