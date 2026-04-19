/** Open redirect guard: internal path only, same-origin. */
export function safeInternalPath(raw: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t.startsWith('/') || t.startsWith('//') || t.includes('://')) return null;
  return t;
}

export function defaultHomeForProfileRole(role: string): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'technician') return '/technician/dashboard';
  if (role === 'supplier') return '/supplier/dashboard';
  return '/customer/home';
}

export function postLoginPath(role: string, returnTo: string | null): string {
  const rt = safeInternalPath(returnTo);
  if (rt) {
    if (role === 'admin' && rt.startsWith('/admin')) return rt;
    if (role === 'customer' && rt.startsWith('/customer')) return rt;
    if (role === 'technician' && rt.startsWith('/technician')) return rt;
    if (role === 'supplier' && rt.startsWith('/supplier')) return rt;
  }
  return defaultHomeForProfileRole(role);
}
