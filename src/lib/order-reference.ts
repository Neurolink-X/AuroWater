const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PUBLIC_REFERENCE_PATTERN = /^AW-(?:[0-9]{8}|[0-9a-f]{32}|[0-9]{8}-[0-9]{6,})$/i;

/** Human-facing order references are complete and never derived from an internal UUID. */
export function formatOrderReference(order: unknown): string {
  const row = order && typeof order === 'object' ? order as { order_number?: unknown } : null;
  const value = typeof row?.order_number === 'string' ? row.order_number.trim() : '';
  return value && PUBLIC_REFERENCE_PATTERN.test(value) ? value.toUpperCase() : '—';
}

/** Accept UUIDs for existing internal links and public references for support/admin lookup. */
export function parseOrderIdentifier(value: string):
  | { kind: 'uuid'; value: string }
  | { kind: 'reference'; value: string }
  | null {
  const normalized = value.trim();
  if (UUID_PATTERN.test(normalized)) return { kind: 'uuid', value: normalized.toLowerCase() };
  if (PUBLIC_REFERENCE_PATTERN.test(normalized)) return { kind: 'reference', value: normalized.toUpperCase() };
  return null;
}
