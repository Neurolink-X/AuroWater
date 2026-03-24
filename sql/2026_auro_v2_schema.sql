-- AuroWater v2 schema extensions for marketplace roles and pricing

-- 1) Extend role + status on users

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'SUPPLIER'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'SUPPLIER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'PLUMBER'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'PLUMBER';
  END IF;
END$$;

CREATE TYPE user_status AS ENUM ('active', 'pending', 'suspended', 'banned');

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS area VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;


-- 2) Suppliers

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  aadhaar_number VARCHAR(20),
  price_per_can NUMERIC(5,2) CHECK (price_per_can BETWEEN 10 AND 15),
  service_radius_km NUMERIC(5,2) DEFAULT 3.0,
  is_online BOOLEAN DEFAULT false,
  upi_id VARCHAR(255),
  total_earnings NUMERIC(12,2) DEFAULT 0,
  area_lat DECIMAL(10,8),
  area_lng DECIMAL(11,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 3) Plumbers

CREATE TABLE IF NOT EXISTS plumbers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  aadhaar_number VARCHAR(20),
  skills TEXT[],
  experience_years INTEGER,
  is_available BOOLEAN DEFAULT false,
  upi_id VARCHAR(255),
  service_area VARCHAR(255),
  rating NUMERIC(3,2) DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 4) Extend existing orders table with marketplace-specific fields

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cans_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS water_price_per_can NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS landmark TEXT;


-- 5) Plumber jobs

CREATE TYPE plumber_job_status AS ENUM ('pending','accepted','in_progress','completed','cancelled');

CREATE TABLE IF NOT EXISTS plumber_jobs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plumber_id INTEGER NOT NULL REFERENCES plumbers(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL,
  status plumber_job_status NOT NULL DEFAULT 'pending',
  customer_price NUMERIC(10,2) NOT NULL,
  booking_fee NUMERIC(10,2) NOT NULL DEFAULT 20,
  address TEXT NOT NULL,
  landmark TEXT,
  scheduled_at TIMESTAMP,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 6) Bulk requests

CREATE TYPE bulk_request_status AS ENUM ('new','quoted','confirmed','completed');

CREATE TABLE IF NOT EXISTS bulk_requests (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100),
  cans_needed INTEGER,
  tanker_needed BOOLEAN DEFAULT false,
  plumber_needed BOOLEAN DEFAULT false,
  event_date DATE,
  address TEXT NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  status bulk_request_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 7) Key/value app_settings with seeded config

ALTER TABLE app_settings RENAME TO app_settings_contact;

CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL
);

INSERT INTO app_settings (key, value) VALUES
  ('support_email', 'support.aurotap@gmail.com'),
  ('support_phone', '9889305803'),
  ('brand_name', 'Auro Water'),
  ('max_can_price', '15'),
  ('min_can_price', '10'),
  ('platform_fee_per_order', '2'),
  ('plumber_booking_fee', '20'),
  ('bulk_commission_percent', '5')
ON CONFLICT (key) DO NOTHING;


-- 8) Admin logs

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  details TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 9) Founding members waitlist

CREATE TABLE IF NOT EXISTS founding_members (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


