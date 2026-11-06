
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
 * Optional redacted recovery manifest with table names and migration tracker state.
 * Output is strictly confined to the local generated artifacts directory.
 * No table/schema writes or default credentials are ever allowed.
 */
function writeReadinessReport(required, optional, migrationTracking) {
  const outputPath = process.env.DB_READINESS_REPORT_PATH?.trim();
  if (!outputPath) return;
  const allowed = /^artifacts\/db-readiness\/[a-zA-Z0-9_-]+\.json$/;
  if (!allowed.test(outputPath) || isAbsolute(outputPath)) {
    throw new Error("DB_READINESS_REPORT_PATH_INVALID");
  }
  const output = resolve(process.cwd(), outputPath);
  if (!allowed.test(relative(process.cwd(), output).replaceAll("\\", "/"))) {
    throw new Error("DB_READINESS_REPORT_PATH_INVALID");
  }
  const report = {
    format: "aurotap-db-readiness-v1",
    checked_at: new Date().toISOString(),
    required: { checked: required.checked, missing: required.missingNames },
    optional: { checked: optional.checked, missing: optional.missingNames },
    migration_history_detected: migrationTracking,
    schema_auto_creation: false,
    recovery: "Run db:audit-migrations and db:inspect-live; review a versioned migration on staging before any approved production schema change.",
  };
  fs.mkdirSync(dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  log("Sanitized readiness report generated.");
}

function explainMissingSchema(required, optional, migrationTracking) {
  if (!required.missing && !optional.missing && migrationTracking) return;
  warn("Missing tables require reviewed migrations; do not create them independently with CREATE TABLE IF NOT EXISTS.");
  warn("Inspect migration history with npm run db:audit-migrations and npm run db:inspect-live.");
  warn("Review RLS, constraints, triggers, dependent functions and backups on staging before production approval.");
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
    explainMissingSchema(required, optional, migrationTracking);

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
        fail("DB_READINESS_REPORT_PATH must be artifacts/db-readiness/<name>.json.");
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
