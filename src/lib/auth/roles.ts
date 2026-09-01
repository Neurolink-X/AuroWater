export function uiRoleToDb(
  role: string
): 'customer' | 'supplier' | 'technician' | 'admin' {
  const r = role.toLowerCase();
  if (r === 'seller' || r === 'supplier') return 'supplier';
  if (r === 'agent' || r === 'technician' || r === 'plumber') return 'technician';
  if (r === 'admin') return 'admin';
  return 'customer';
}

export function needsApproval(dbRole: string): boolean {
  return dbRole === 'supplier' || dbRole === 'technician';
}

export function phoneToAuthEmail(phone: string): string {
  const d = phone.replace(/\D/g, '').slice(-10);
  return `${d}@users.aurotap.in`;
}
