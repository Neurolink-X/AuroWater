#!/usr/bin/env node
/**
 * Database-backed dispatch concurrency tests for a disposable Supabase project.
 *
 * This script mutates ONLY explicitly provisioned TEST-DISPATCH-* order fixtures.
 * It deliberately refuses production-looking database names and never creates
 * fixtures from real customer records.
 *
 * Required:
 *   AUROWATER_TEST_DATABASE_URL
 *   AUROWATER_ALLOW_DISPATCH_TESTS=1
 *   AUROWATER_DISPATCH_TEST_FIXTURES=<JSON>
 *
 * Fixture JSON:
 * {
 *   "supplierRaceOrderId":"uuid",
 *   "supplierIds":["uuid","uuid"],
 *   "stockRaceOrderIds":["uuid","uuid"],
 *   "stockRaceSupplierId":"uuid",
 *   "technicianRaceOrderId":"uuid",
 *   "technicianIds":["uuid","uuid"]
 * }
 *
 * All order_number values must start with TEST-DISPATCH-. Test rows remain
 * assigned after the run; discard/reset the disposable database afterwards.
 */
import pg from 'pg';

const connectionString = process.env.AUROWATER_TEST_DATABASE_URL;
if (process.env.AUROWATER_ALLOW_DISPATCH_TESTS !== '1' || !connectionString) {
  console.error('Refusing to run. Set AUROWATER_ALLOW_DISPATCH_TESTS=1 and AUROWATER_TEST_DATABASE_URL for a disposable test database.');
  process.exit(2);
}

let fixtures;
try {
  fixtures = JSON.parse(process.env.AUROWATER_DISPATCH_TEST_FIXTURES || '');
} catch {
  console.error('AUROWATER_DISPATCH_TEST_FIXTURES must be valid JSON.');
  process.exit(2);
}

const required = ['supplierRaceOrderId', 'supplierIds', 'stockRaceOrderIds', 'stockRaceSupplierId', 'technicianRaceOrderId', 'technicianIds'];
if (required.some((key) => fixtures?.[key] == null)) {
  console.error('Dispatch fixture JSON is missing required keys.');
  process.exit(2);
}
if (fixtures.supplierIds.length !== 2 || fixtures.stockRaceOrderIds.length !== 2 || fixtures.technicianIds.length !== 2) {
  console.error('Each race test requires exactly two competing IDs.');
  process.exit(2);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString,
  max: 8,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
  application_name: 'aurotap-dispatch-concurrency-test',
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function withServiceRole(sql, values = []) {
  const client = await pool.connect();
  try {
    await client.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await client.query("select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false)");
    return await client.query(sql, values);
  } finally {
    client.release();
  }
}

async function readOrder(id) {
  const result = await pool.query(
    "select id, order_number, status, service_type, supplier_id, technician_id, can_count, stock_reserved_quantity from public.orders where id = $1",
    [id],
  );
  assert(result.rowCount === 1, `Fixture order not found: ${id}`);
  assert(String(result.rows[0].order_number).startsWith('TEST-DISPATCH-'), 'Refusing to mutate an order without TEST-DISPATCH- prefix.');
  assert(result.rows[0].status === 'PENDING', `Fixture order must be PENDING: ${id}`);
  assert(!result.rows[0].supplier_id && !result.rows[0].technician_id, `Fixture order must be unassigned: ${id}`);
  return result.rows[0];
}

async function raceRpc(label, calls) {
  const results = await Promise.all(calls.map((call) => withServiceRole(call.sql, call.values)));
  const winners = results.filter((result) => result.rows[0]?.won === true || result.rows[0]?.assigned === true || result.rows[0]?.result === true).length;
  assert(winners === 1, `${label}: expected exactly one winner, got ${winners}`);
  console.log(`PASS ${label}: exactly one concurrent assignment won`);
  return results;
}

try {
  const identity = await pool.query('select current_database() as db, inet_server_addr()::text as server');
  const databaseName = String(identity.rows[0]?.db ?? '').toLowerCase();
  assert(/test|staging|branch/.test(databaseName), 'Database name must contain test, staging, or branch. Refusing production-like database.');
  console.log(`Running against disposable database: ${databaseName}`);

  const supplierRace = await readOrder(fixtures.supplierRaceOrderId);
  assert(Number(supplierRace.can_count ?? 0) > 0, 'Supplier race order must have can_count > 0.');
  const [supplierA, supplierB] = fixtures.supplierIds;
  const supplierProfiles = await pool.query(
    "select id from public.profiles where id = any($1::uuid[]) and role = 'supplier' and is_active = true",
    [[supplierA, supplierB]],
  );
  assert(supplierProfiles.rowCount === 2, 'Both supplier fixture profiles must exist and be active.');
  const supplierStock = await pool.query(
    'select supplier_id, cans_available, reserved_cans, reservation_buffer_cans from public.supplier_stock where supplier_id = any($1::uuid[])',
    [[supplierA, supplierB]],
  );
  assert(supplierStock.rowCount === 2, 'Both supplier fixtures need supplier_stock rows.');
  for (const row of supplierStock.rows) {
    assert(Number(row.cans_available) - Number(row.reserved_cans) - Number(row.reservation_buffer_cans) >= Number(supplierRace.can_count), 'Each competing supplier needs enough available stock for the race order.');
  }
  await raceRpc('same order / two suppliers', [
    { sql: 'select public.try_assign_supplier_with_stock($1::uuid,$2::uuid,null) as won', values: [fixtures.supplierRaceOrderId, supplierA] },
    { sql: 'select public.try_assign_supplier_with_stock($1::uuid,$2::uuid,null) as won', values: [fixtures.supplierRaceOrderId, supplierB] },
  ]);

  const stockOrders = await Promise.all(fixtures.stockRaceOrderIds.map(readOrder));
  const stockQty = stockOrders.map((row) => Number(row.can_count ?? 0));
  assert(stockQty.every((qty) => qty > 0), 'Stock race orders must each require at least one can.');
  const stockSupplier = await pool.query(
    'select cans_available, reserved_cans, reservation_buffer_cans from public.supplier_stock where supplier_id = $1',
    [fixtures.stockRaceSupplierId],
  );
  assert(stockSupplier.rowCount === 1, 'Stock race supplier_stock row is missing.');
  const usable = Number(stockSupplier.rows[0].cans_available) - Number(stockSupplier.rows[0].reserved_cans) - Number(stockSupplier.rows[0].reservation_buffer_cans);
  assert(usable >= Math.max(...stockQty) && usable < stockQty.reduce((sum, qty) => sum + qty, 0), 'Stock fixture must cover either order individually, but not both.');
  await raceRpc('two orders / one supplier stock pool', fixtures.stockRaceOrderIds.map((orderId) => ({
    sql: 'select public.try_assign_supplier_with_stock($1::uuid,$2::uuid,null) as won',
    values: [orderId, fixtures.stockRaceSupplierId],
  })));

  const technicianRace = await readOrder(fixtures.technicianRaceOrderId);
  assert(String(technicianRace.service_type ?? '').toLowerCase() !== 'water_can', 'Technician fixture order must be a technician service, not water_can.');
  const [technicianA, technicianB] = fixtures.technicianIds;
  const technicianProfiles = await pool.query(
    "select id from public.profiles where id = any($1::uuid[]) and role = 'technician' and is_active = true and lower(coalesce(status,'')) = 'active' and lower(coalesce(availability_status,'available')) in ('available','online')",
    [[technicianA, technicianB]],
  );
  assert(technicianProfiles.rowCount === 2, 'Both technician fixture profiles must be active and available.');
  await raceRpc('same job / two technicians', [
    { sql: 'select public.try_assign_technician($1::uuid,$2::uuid,null,50) as won', values: [fixtures.technicianRaceOrderId, technicianA] },
    { sql: 'select public.try_assign_technician($1::uuid,$2::uuid,null,50) as won', values: [fixtures.technicianRaceOrderId, technicianB] },
  ]);

  console.log('All dispatch concurrency checks passed. Discard or reset this disposable database before reusing fixtures.');
} catch (error) {
  console.error('Dispatch concurrency test failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await pool.end();
}
