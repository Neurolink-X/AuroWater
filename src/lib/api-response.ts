/** Standard API envelope helpers for route handlers. */
export function ok(data: unknown, message = 'Success', status = 200) {
  return Response.json({ data, message }, { status });
}

export function err(error: string, status = 500, details?: unknown) {
  return Response.json({ error, ...(details !== undefined ? { details } : {}) }, { status });
}
