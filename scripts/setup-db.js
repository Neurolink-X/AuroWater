require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  allowExitOnIdle: true,
  connectionTimeoutMillis: 15000,
});

async function setup() {
  const client = await pool.connect();
  try {
    console.log('✅ Connected to Supabase!');
    
    // Create all tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) UNIQUE,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'customer',
        status VARCHAR(20) DEFAULT 'active',
        city VARCHAR(100),
        area VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        business_name VARCHAR(255),
        aadhaar_number VARCHAR(12),
        price_per_can INTEGER DEFAULT 12,
        service_radius_km INTEGER DEFAULT 5,
        is_online BOOLEAN DEFAULT false,
        upi_id VARCHAR(100),
        total_earnings DECIMAL DEFAULT 0,
        stock_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS plumbers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        aadhaar_number VARCHAR(12),
        skills TEXT[],
        experience_years INTEGER DEFAULT 0,
        is_available BOOLEAN DEFAULT false,
        upi_id VARCHAR(100),
        service_area VARCHAR(255),
        rating DECIMAL DEFAULT 0,
        total_jobs INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES users(id),
        supplier_id INTEGER REFERENCES users(id),
        cans_quantity INTEGER NOT NULL,
        status VARCHAR(30) DEFAULT 'pending',
        water_price_per_can INTEGER,
        platform_fee INTEGER DEFAULT 2,
        total_amount INTEGER,
        payment_method VARCHAR(20) DEFAULT 'cash',
        address TEXT,
        landmark TEXT,
        scheduled_time TIMESTAMP,
        is_emergency BOOLEAN DEFAULT false,
        can_purchase BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS plumber_jobs (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES users(id),
        plumber_id INTEGER REFERENCES users(id),
        service_type VARCHAR(100),
        status VARCHAR(30) DEFAULT 'pending',
        customer_price INTEGER,
        booking_fee INTEGER DEFAULT 20,
        address TEXT,
        landmark TEXT,
        scheduled_at TIMESTAMP,
        description TEXT,
        is_emergency BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bulk_requests (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES users(id),
        event_type VARCHAR(100),
        cans_needed INTEGER DEFAULT 0,
        tanker_needed BOOLEAN DEFAULT false,
        plumber_needed BOOLEAN DEFAULT false,
        event_date TIMESTAMP,
        address TEXT,
        contact_phone VARCHAR(20),
        status VARCHAR(30) DEFAULT 'new',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id),
        action VARCHAR(255),
        target_user_id INTEGER,
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS founding_members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        phone VARCHAR(20) UNIQUE,
        city VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS service_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        min_price INTEGER DEFAULT 0,
        max_price INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        icon VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ All tables created!');

    // Seed admin
    const adminHash = await bcrypt.hash('@India#23', 10);
    await client.query(`
      INSERT INTO users 
        (name, phone, email, password_hash, role, status, city)
      VALUES 
        ('Arjun Chaurasiya', '9889305803', 
         'Arjunchaurasiya1254@gmail.com',
         $1, 'admin', 'active', 'Gorakhpur')
      ON CONFLICT (email) DO NOTHING;
    `, [adminHash]);
    console.log('✅ Admin seeded!');

    // Seed app settings
    const settings = [
      ['support_email', 'support.aurotap@gmail.com'],
      ['support_phone', '9889305803'],
      ['brand_name', 'Auro Water'],
      ['platform_fee_per_order', '2'],
      ['plumber_booking_fee', '20'],
      ['bulk_commission_percent', '5'],
      ['max_can_price', '15'],
      ['min_can_price', '10'],
      ['whatsapp_number', '919889305803'],
    ];
    for (const [key, value] of settings) {
      await client.query(`
        INSERT INTO app_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING;
      `, [key, value]);
    }
    console.log('✅ App settings seeded!');

    // Seed service types
    const services = [
      ['Pipe Fitting & Repair', 100, 200, '🔩'],
      ['Tap / Valve Fix', 100, 150, '🚿'],
      ['Pump Install/Repair', 300, 500, '💧'],
      ['Tank Cleaning', 200, 400, '🪣'],
      ['Boring/Borewell', 800, 2000, '🕳️'],
      ['Purifier Installation', 200, 350, '🔌'],
      ['New Water Connection', 400, 800, '🏗️'],
      ['Event/Party Setup', 0, 0, '🎪'],
    ];
    for (const [name, min, max, icon] of services) {
      await client.query(`
        INSERT INTO service_types (name, min_price, max_price, icon)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING;
      `, [name, min, max, icon]);
    }
    console.log('✅ Service types seeded!');

    console.log('');
    console.log('🎉 DATABASE SETUP COMPLETE!');
    console.log('Admin: Arjunchaurasiya1254@gmail.com');
    console.log('Password: @India#23');
    console.log('Login at: /admin/login');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();

