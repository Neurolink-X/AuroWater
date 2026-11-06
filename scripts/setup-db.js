
"use strict";

/**
 * AUROTAP — SAFE DATABASE READINESS CHECKER
 *
 * File: scripts/setup-db.js
 *
 * Next.js 16 | Supabase PostgreSQL | Node.js 22+
 *
 * PURPOSE:
 * - Verify database connectivity
 * - Check required application tables
 * - Inspect migration tracking availability
 * - Report missing database structures
 * - Prevent unsafe legacy database initialization
 *
 * SECURITY:
 * - Read-only transaction
 * - No CREATE / ALTER / DROP
 * - No INSERT / UPDATE / DELETE
 * - No admin account creation
 * - No default passwords
 * - No pricing modifications
 * - No automatic migrations
 * - No secrets printed
 *
 * This script is a readiness checker,
 * NOT a database initializer.
 */

const fs = require("node:fs");
const { resolve, dirname, relative, isAbsolute } = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

// Load local environment variables without
// overriding values supplied by the runtime.
dotenv.config({
  path: resolve(process.cwd(), ".env.local"),
  quiet: true,
});

const APP_NAME = "aurotap-db-readiness";
const EXPECTED_PROJECT = "mwfcwhxdlnqldciigicl";

// Core tables based on the provided AuroTap architecture.
// Update only after checking the actual migration schema.
const REQUIRED_TABLES = Object.freeze([
  "public.profiles",
  "public.addresses",
  "public.service_types",
  "public.orders",
  "public.settings",
]);

// Additional application modules.
// Missing entries generate warnings rather than
// claiming the entire database is unusable.
const OPTIONAL_TABLES = Object.freeze([
  "public.supplier_settings",
  "public.supplier_stock",
  "public.order_dispatch",
  "public.wallet_ledger",
  "public.payouts",
  "public.notifications",
  "public.water_subscriptions",
  "public.referral_credits",
  "public.reviews",
  "public.pincode_directory",
  "public.city_waitlist",
]);

const MIGRATION_TABLES = Object.freeze([
  "supabase_migrations.schema_migrations",
  "public.schema_migrations",
]);

const TIMEOUT_MS = 15000;
const QUERY_TIMEOUT_MS = 8000;

function log(message) {
  console.log(`[AuroTap DB] ${message}`);
}

function warn(message) {
  console.warn(`[AuroTap DB] WARNING: ${message}`);
}

function fail(message) {
  console.error(`[AuroTap DB] ERROR: ${message}`);
}

/**
 * Never display credentials or connection strings.
 */
function safeError(error) {
  const allowedCodes = new Set([
    "28P01",
    "28000",
    "3D000",
    "42501",
    "42P01",
    "53300",
    "57P01",
    "57014",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ECONNRESET",
  ]);

  const code = String(error?.code || "");

  if (allowedCodes.has(code)) {
    return `Database error code: ${code}`;
  }

  return "Database connection or validation failed. Check secure server logs.";
}

/**
 * Read environment configuration safely.
 */
function getDatabaseConfig() {
  const raw = process.env.DATABASE_URL?.trim();

  if (!raw) {
    throw new Error("DATABASE_URL_MISSING");
  }

  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL_INVALID");
  }

  if (
    parsed.protocol !== "postgresql:" &&
    parsed.protocol !== "postgres:"
  ) {
    throw new Error("DATABASE_URL_INVALID");
  }

  if (!parsed.hostname) {
    throw new Error("DATABASE_URL_INVALID");
  }

  // Remove SSL parameters that could override
  // the verified TLS configuration in node-postgres.
  const sslKeys = [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
  ];

  for (const key of sslKeys) {
    parsed.searchParams.delete(key);
  }

  // Optional project identity check for Supabase
  // database endpoints, without printing the URL.
  const host = parsed.hostname.toLowerCase();
  const username = decodeURIComponent(parsed.username);

  const isSupabaseHost =
    host.endsWith(".supabase.co") ||
    host.endsWith(".supabase.com");

  const isExpectedDirectHost =
    host === `db.${EXPECTED_PROJECT}.supabase.co`;

  const isExpectedPoolerUser =
    username.endsWith(`.${EXPECTED_PROJECT}`);

  if (
    isSupabaseHost &&
    !isExpectedDirectHost &&
    !isExpectedPoolerUser
  ) {
    throw new Error("SUPABASE_PROJECT_MISMATCH");
  }

  // Optional custom CA certificate.
  // Useful when system trust roots do not
  // contain the Supabase database CA.
  const caPath =
    process.env.SUPABASE_DB_CA_CERT_PATH?.trim();

  let ca;

  if (caPath) {
    ca = fs.readFileSync(
      resolve(caPath),
      "utf8"
    );
  }

  return {
    connectionString: parsed.toString(),

    // Verify the server certificate instead of
    // disabling TLS verification.
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
    },

    connectionTimeoutMillis: TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
    application_name: APP_NAME,
  };
}

/**
 * Inspect relation existence using PostgreSQL
 * system catalogs.
 *
 * This does not read customer information.
 */
async function checkRelations(client, names) {
  const result = await client.query(
    `
    SELECT
      requested.name,
      to_regclass(requested.name) IS NOT NULL
        AS exists
    FROM unnest($1::text[]) AS requested(name)
    ORDER BY requested.name
    `,
    [names]
  );

  return result.rows.map((row) => ({
    name: row.name,
    exists: row.exists,
  }));
}

/**
 * Report database identity and connectivity.
 */
async function checkConnection(client) {
  const result = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      current_setting(
        'server_version_num'
      )::integer AS server_version_num,
      pg_is_in_recovery() AS replica,
      current_setting(
        'transaction_read_only'
      ) AS read_only
  `);

  const info = result.rows[0];

  log("Database connection successful.");
  log(
    `PostgreSQL version number: ${info.server_version_num}`
  );
  log(
    `Read-only transaction: ${info.read_only}`
  );

  if (info.replica) {
    warn("Connected to a PostgreSQL read replica.");
  }

  return info;
}

/**
 * Check required tables.
 */
async function checkRequiredTables(client) {
  log("Checking essential application tables...");

  const results = await checkRelations(
    client,
    REQUIRED_TABLES
  );

  let missing = 0;
  const missingNames = [];

  for (const item of results) {
    if (item.exists) {
      log(`OK: ${item.name}`);
    } else {
      fail(`Missing required table: ${item.name}`);
      missing += 1;
      missingNames.push(item.name);
    }
  }

  return {
    checked: results.length,
    missing,
    missingNames,
  };
}

/**
 * Check optional modules.
 */
async function checkOptionalTables(client) {
  log("Checking additional application modules...");

  const results = await checkRelations(
    client,
    OPTIONAL_TABLES
  );

  let missing = 0;
  const missingNames = [];

  for (const item of results) {
    if (!item.exists) {
      warn(`Not found: ${item.name}`);
      missing += 1;
      missingNames.push(item.name);
    }
  }

  log(
    `Additional tables: ${
      results.length - missing
    }/${results.length} found.`
  );

  return {
    checked: results.length,
    missing,
    missingNames,
  };
}

/**
 * Migration tracking discovery.
 *
 * Do not create, repair or modify migration
 * history automatically.
 */
async function checkMigrationHistory(client) {
  log("Checking migration tracking...");

  const results = await checkRelations(
    client,
    MIGRATION_TABLES
  );

  const existing = results.filter(
    (item) => item.exists
  );

  if (existing.length === 0) {
    warn(
      "No recognized migration history table found."
    );

    warn(
      "Review the project's custom migration audit before deployment."
    );

    return false;
  }

  for (const item of existing) {
    log(`Migration tracking found: ${item.name}`);
  }

  if (existing.length > 1) {
    warn(
      "Multiple migration trackers detected. Reconcile their histories before schema changes."
    );
  }

  return true;
}


/**
 * Optional, sanitized and machine-readable schema recovery report.
 * This intentionally does NOT include credentials, customer rows, or arbitrary SQL.
 * The only allowed output location is artifacts/db-readiness/<filename>.json.
 */
function writeReadinessReport(required, optional, migrationTracking) {
  const filename = process.env.DB_READINESS_REPORT_PATH?.trim();
  if (!filename) return;

  // Only allow a dedicated ignored artifacts folder, never source/config files.
  const allowed = /^artifacts\/db-readiness\/[a-zA-Z0-9_-]+\.json$/;
  if (!allowed.test(filename) || isAbsolute(filename)) {
    throw new Error("DB_READINESS_REPORT_PATH_INVALID");
  }
  const output = resolve(process.cwd(), filename);
  const relativePath = relative(process.cwd(), output).replaceAll("\\", "/");
  if (!allowed.test(relativePath)) {
    throw new Error("DB_READINESS_REPORT_PATH_INVALID");
  }

  const report = {
    format: "aurotap-db-readiness-v1",
    checked_at: new Date().toISOString(),
    required_tables: {
      checked: required.checked,
      missing: required.missingNames,
      ready: required.missing === 0,
    },
    optional_tables: {
      checked: optional.checked,
      missing: optional.missingNames,
    },
    migration_history_detected: migrationTracking,
    production_schema_auto_creation: false,
    recovery_runbook: "docs/DATABASE_SCHEMA_RECOVERY.md",
  };

  fs.mkdirSync(dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  log("Saved sanitized database readiness report in artifacts/db-readiness/.");
}

function explainSchemaRecovery(required, optional, migrationTracking) {
  if (!required.missing && !optional.missing && migrationTracking) return;
  warn("Do not auto-create isolated tables: foreign keys, triggers, RLS and migration history must remain consistent.");
  warn("Run npm run db:audit-migrations and reconcile versioned migration history against the live database.");
  warn("Test the reviewed repair on staging, verify RLS/constraints, take a backup, then obtain approval before production migrations.");
  warn("Recovery instructions: docs/DATABASE_SCHEMA_RECOVERY.md");
}

/**
 * Main execution.
 */
async function setup() {
  let client;
  let transactionStarted = false;

  log("Starting safe database readiness check.");

  try {
    const config = getDatabaseConfig();

    client = new Client(config);

    await client.connect();

    // Explicitly prevent SQL writes within
    // the readiness-check transaction.
    await client.query(
      "BEGIN TRANSACTION READ ONLY"
    );

    transactionStarted = true;

    await checkConnection(client);

    const required = await checkRequiredTables(
      client
    );

    const optional = await checkOptionalTables(
      client
    );

    const migrationTracking =
      await checkMigrationHistory(client);

    // Always roll back the read-only transaction
    // to leave no transaction open.
    await client.query("ROLLBACK");
    transactionStarted = false;

    log("----------------------------------");
    log("DATABASE READINESS SUMMARY");
    log("----------------------------------");

    log(
      `Required tables: ${
        required.checked - required.missing
      }/${required.checked}`
    );

    log(
      `Optional tables: ${
        optional.checked - optional.missing
      }/${optional.checked}`
    );

    log(
      `Migration tracking detected: ${
        migrationTracking ? "YES" : "NO"
      }`
    );

    writeReadinessReport(required, optional, migrationTracking);
    explainSchemaRecovery(required, optional, migrationTracking);

    if (required.missing > 0) {
      fail(
        "Database is missing essential application tables."
      );

      process.exitCode = 1;
      return;
    }

    log("Required schema readiness checks passed.");

    if (
      optional.missing > 0 ||
      !migrationTracking
    ) {
      warn(
        "Review warnings before production deployment."
      );
    }

    log(
      "No database records or schema were modified."
    );
  } catch (error) {
    switch (error.message) {
      case "DATABASE_URL_MISSING":
        fail("DATABASE_URL is not configured.");
        break;

      case "DATABASE_URL_INVALID":
        fail("DATABASE_URL format is invalid.");
        break;

      case "DB_READINESS_REPORT_PATH_INVALID":
        fail("Report path must be artifacts/db-readiness/<safe-name>.json.");
        break;

      case "SUPABASE_PROJECT_MISMATCH":
        fail(
          "Database endpoint does not match the expected Supabase project identity."
        );
        break;

      default:
        fail(safeError(error));
        break;
    }

    process.exitCode = 1;
  } finally {
    if (client) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch {
          warn(
            "Could not complete rollback; closing connection."
          );
          process.exitCode = 1;
        }
      }

      try {
        await client.end();
      } catch {
        warn("Database connection cleanup failed.");
        process.exitCode = 1;
      }
    }
  }
}

setup().catch(() => {
  fail("Unexpected readiness-check failure.");
  process.exitCode = 1;
});






// require('dotenv').config({ path: '.env.local' });
// const { Pool } = require('pg');
// const bcrypt = require('bcryptjs');

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false },
//   max: 1,
//   allowExitOnIdle: true,
//   connectionTimeoutMillis: 15000,
// });

// async function setup() {
//   const client = await pool.connect();
//   try {
//     console.log('✅ Connected to Supabase!');
    
//     // Create all tables
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS users (
//         id SERIAL PRIMARY KEY,
//         name VARCHAR(255) NOT NULL,
//         phone VARCHAR(20) UNIQUE,
//         email VARCHAR(255) UNIQUE,
//         password_hash VARCHAR(255) NOT NULL,
//         role VARCHAR(20) DEFAULT 'customer',
//         status VARCHAR(20) DEFAULT 'active',
//         city VARCHAR(100),
//         area VARCHAR(100),
//         created_at TIMESTAMP DEFAULT NOW(),
//         last_login TIMESTAMP
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS suppliers (
//         id SERIAL PRIMARY KEY,
//         user_id INTEGER REFERENCES users(id),
//         business_name VARCHAR(255),
//         aadhaar_number VARCHAR(12),
//         price_per_can INTEGER DEFAULT 12,
//         service_radius_km INTEGER DEFAULT 5,
//         is_online BOOLEAN DEFAULT false,
//         upi_id VARCHAR(100),
//         total_earnings DECIMAL DEFAULT 0,
//         stock_count INTEGER DEFAULT 0,
//         created_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS plumbers (
//         id SERIAL PRIMARY KEY,
//         user_id INTEGER REFERENCES users(id),
//         aadhaar_number VARCHAR(12),
//         skills TEXT[],
//         experience_years INTEGER DEFAULT 0,
//         is_available BOOLEAN DEFAULT false,
//         upi_id VARCHAR(100),
//         service_area VARCHAR(255),
//         rating DECIMAL DEFAULT 0,
//         total_jobs INTEGER DEFAULT 0,
//         created_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS orders (
//         id SERIAL PRIMARY KEY,
//         customer_id INTEGER REFERENCES users(id),
//         supplier_id INTEGER REFERENCES users(id),
//         cans_quantity INTEGER NOT NULL,
//         status VARCHAR(30) DEFAULT 'pending',
//         water_price_per_can INTEGER,
//         platform_fee INTEGER DEFAULT 2,
//         total_amount INTEGER,
//         payment_method VARCHAR(20) DEFAULT 'cash',
//         address TEXT,
//         landmark TEXT,
//         scheduled_time TIMESTAMP,
//         is_emergency BOOLEAN DEFAULT false,
//         can_purchase BOOLEAN DEFAULT false,
//         created_at TIMESTAMP DEFAULT NOW(),
//         updated_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS plumber_jobs (
//         id SERIAL PRIMARY KEY,
//         customer_id INTEGER REFERENCES users(id),
//         plumber_id INTEGER REFERENCES users(id),
//         service_type VARCHAR(100),
//         status VARCHAR(30) DEFAULT 'pending',
//         customer_price INTEGER,
//         booking_fee INTEGER DEFAULT 20,
//         address TEXT,
//         landmark TEXT,
//         scheduled_at TIMESTAMP,
//         description TEXT,
//         is_emergency BOOLEAN DEFAULT false,
//         created_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS bulk_requests (
//         id SERIAL PRIMARY KEY,
//         customer_id INTEGER REFERENCES users(id),
//         event_type VARCHAR(100),
//         cans_needed INTEGER DEFAULT 0,
//         tanker_needed BOOLEAN DEFAULT false,
//         plumber_needed BOOLEAN DEFAULT false,
//         event_date TIMESTAMP,
//         address TEXT,
//         contact_phone VARCHAR(20),
//         status VARCHAR(30) DEFAULT 'new',
//         admin_notes TEXT,
//         created_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS app_settings (
//         id SERIAL PRIMARY KEY,
//         key VARCHAR(100) UNIQUE NOT NULL,
//         value TEXT NOT NULL,
//         updated_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS admin_logs (
//         id SERIAL PRIMARY KEY,
//         admin_id INTEGER REFERENCES users(id),
//         action VARCHAR(255),
//         target_user_id INTEGER,
//         details TEXT,
//         ip_address VARCHAR(50),
//         created_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS founding_members (
//         id SERIAL PRIMARY KEY,
//         name VARCHAR(255),
//         phone VARCHAR(20) UNIQUE,
//         city VARCHAR(100),
//         created_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS service_types (
//         id SERIAL PRIMARY KEY,
//         name VARCHAR(255) NOT NULL,
//         min_price INTEGER DEFAULT 0,
//         max_price INTEGER DEFAULT 0,
//         is_active BOOLEAN DEFAULT true,
//         icon VARCHAR(10),
//         created_at TIMESTAMP DEFAULT NOW()
//       );
//     `);

//     console.log('✅ All tables created!');

//     // Seed admin
//     const adminHash = await bcrypt.hash('@India#23', 10);
//     await client.query(`
//       INSERT INTO users 
//         (name, phone, email, password_hash, role, status, city)
//       VALUES 
//         ('Arjun Chaurasiya', '9889305803', 
//          'Arjunchaurasiya1254@gmail.com',
//          $1, 'admin', 'active', 'Gorakhpur')
//       ON CONFLICT (email) DO NOTHING;
//     `, [adminHash]);
//     console.log('✅ Admin seeded!');

//     // Seed app settings
//     const settings = [
//       ['support_email', 'support.aurotap@gmail.com'],
//       ['support_phone', '9889305803'],
//       ['brand_name', 'Auro Water'],
//       ['platform_fee_per_order', '2'],
//       ['plumber_booking_fee', '20'],
//       ['bulk_commission_percent', '5'],
//       ['max_can_price', '15'],
//       ['min_can_price', '10'],
//       ['whatsapp_number', '919889305803'],
//     ];
//     for (const [key, value] of settings) {
//       await client.query(`
//         INSERT INTO app_settings (key, value)
//         VALUES ($1, $2)
//         ON CONFLICT (key) DO NOTHING;
//       `, [key, value]);
//     }
//     console.log('✅ App settings seeded!');

//     // Seed service types
//     const services = [
//       ['Pipe Fitting & Repair', 100, 200, '🔩'],
//       ['Tap / Valve Fix', 100, 150, '🚿'],
//       ['Pump Install/Repair', 300, 500, '💧'],
//       ['Tank Cleaning', 200, 400, '🪣'],
//       ['Boring/Borewell', 800, 2000, '🕳️'],
//       ['Purifier Installation', 200, 350, '🔌'],
//       ['New Water Connection', 400, 800, '🏗️'],
//       ['Event/Party Setup', 0, 0, '🎪'],
//     ];
//     for (const [name, min, max, icon] of services) {
//       await client.query(`
//         INSERT INTO service_types (name, min_price, max_price, icon)
//         VALUES ($1, $2, $3, $4)
//         ON CONFLICT DO NOTHING;
//       `, [name, min, max, icon]);
//     }
//     console.log('✅ Service types seeded!');

//     console.log('');
//     console.log('🎉 DATABASE SETUP COMPLETE!');
//     console.log('Admin: Arjunchaurasiya1254@gmail.com');
//     console.log('Password: @India#23');
//     console.log('Login at: /admin/login');

//   } catch (err) {
//     console.error('❌ Setup failed:', err.message);
//   } finally {
//     client.release();
//     await pool.end();
//   }
// }

// setup();

