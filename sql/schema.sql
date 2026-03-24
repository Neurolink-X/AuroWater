-- AuroWater Database Schema

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'TECHNICIAN', 'ADMIN');
CREATE TYPE service_type AS ENUM ('WATER_SUPPLY', 'SUBMERSIBLE_INSTALLATION', 'REPAIR_MAINTENANCE');
CREATE TYPE order_status AS ENUM ('PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE job_status AS ENUM ('PENDING', 'ACCEPTED', 'ON_THE_WAY', 'WORKING', 'COMPLETED', 'REJECTED');

-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Addresses Table
CREATE TABLE addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  house_no VARCHAR(100) NOT NULL,
  area VARCHAR(255) NOT NULL,
  landmark VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  address_type VARCHAR(50) DEFAULT 'HOME', -- HOME, OFFICE, FARM, etc.
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zones/Locations Table
CREATE TABLE zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  city VARCHAR(100) NOT NULL,
  distance_factor DECIMAL(5, 2) DEFAULT 1.0, -- multiplier for pricing
  base_lat DECIMAL(10, 8),
  base_lng DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service Types Table
CREATE TABLE service_types (
  id SERIAL PRIMARY KEY,
  name service_type NOT NULL UNIQUE,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing Rules Table
CREATE TABLE pricing_rules (
  id SERIAL PRIMARY KEY,
  service_type_id INTEGER NOT NULL REFERENCES service_types(id),
  zone_id INTEGER REFERENCES zones(id),
  base_price DECIMAL(10, 2) NOT NULL,
  distance_multiplier DECIMAL(5, 2) DEFAULT 1.0,
  tax_percentage DECIMAL(5, 2) DEFAULT 0,
  min_order_value DECIMAL(10, 2) DEFAULT 0,
  emergency_charge DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Technicians Table
CREATE TABLE technicians (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialization VARCHAR(255),
  license_number VARCHAR(100) UNIQUE,
  experience_years INTEGER,
  current_zone_id INTEGER REFERENCES zones(id),
  is_available BOOLEAN DEFAULT true,
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  rating DECIMAL(3, 2) DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_id INTEGER NOT NULL REFERENCES addresses(id),
  service_type_id INTEGER NOT NULL REFERENCES service_types(id),
  technician_id INTEGER REFERENCES technicians(id),
  zone_id INTEGER REFERENCES zones(id),
  
  -- Service Details
  service_details JSONB, -- e.g., {"quantity": 500, "unit": "liters"} or {"type": "installation"}
  
  -- Pricing
  base_price DECIMAL(10, 2) NOT NULL,
  distance_factor DECIMAL(5, 2) DEFAULT 1.0,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  emergency_charge DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  
  -- Timing
  scheduled_time TIMESTAMP,
  time_slot VARCHAR(50), -- e.g., "10:00 - 12:00"
  
  -- Status
  status order_status DEFAULT 'PENDING',
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Status History Table
CREATE TABLE order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs Table (for technician assignment)
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  technician_id INTEGER NOT NULL REFERENCES technicians(id),
  status job_status DEFAULT 'PENDING',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Status History Table
CREATE TABLE job_status_history (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status job_status NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Notifications Table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50), -- ORDER, JOB, SYSTEM
  related_id INTEGER, -- order_id or job_id
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App Settings for contact/support (admin managed)
CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  support_email VARCHAR(255),
  secondary_email VARCHAR(255),
  phone_primary VARCHAR(50),
  phone_secondary VARCHAR(50),
  office_address TEXT,
  working_hours VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Create Indexes for better performance
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_technician_id ON orders(technician_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_jobs_technician_id ON jobs(technician_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX idx_technicians_user_id ON technicians(user_id);
CREATE INDEX idx_technicians_is_available ON technicians(is_available);
CREATE INDEX idx_pricing_rules_service_zone ON pricing_rules(service_type_id, zone_id);
