import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('admin assignment picker only returns verified technicians approved for exact order service', () => {
  const api = read('../src/app/api/admin/technicians/route.ts');
  const ui = read('../src/app/admin/orders/page.tsx');
  const client = read('../src/lib/api-client.ts');
  assert.match(api, /technician_service_capabilities/);
  assert.match(api, /\.eq\('service_key', serviceKey\)\.eq\('status', 'approved'\)/);
  assert.match(api, /if \(approvalError\) return jsonErr/);
  assert.match(api, /if \(!approvedIds\.length\) return jsonOk\(\[\]\)/);
  assert.match(ui, /adminTechniciansList\(serviceKey\)/);
  assert.match(ui, /No approved specialist is available for this service/);
  assert.match(client, /encodeURIComponent\(serviceKey\)/);
});
