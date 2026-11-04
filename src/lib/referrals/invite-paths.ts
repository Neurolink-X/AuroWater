/**
 * Referral invitations stay separate from customer reward redemption.
 * Only these two exact destinations may survive a registration hand-off.
 * Never trust a caller-provided arbitrary redirect URL.
 */
export function referralReturnPath(raw: string | null): string | null {
  if (!raw || raw.length > 240 || !raw.startsWith('/') || raw.startsWith('//') ||
      /[\\\x00-\x1f\x7f]/.test(raw)) return null;

  try {
    const url = new URL(raw, 'https://www.aurotap.in');
    if (url.origin !== 'https://www.aurotap.in' || url.hash ||
        Array.from(url.searchParams.keys()).length !== 1) return null;

    if (url.pathname === '/customer/referral') {
      const id = url.searchParams.get('supplier');
      return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? `/customer/referral?supplier=${encodeURIComponent(id)}` : null;
    }
    if (url.pathname === '/customer/referrals') {
      const code = url.searchParams.get('code')?.trim().toUpperCase();
      return code && /^[A-Z0-9-]{3,32}$/.test(code)
        ? `/customer/referrals?code=${encodeURIComponent(code)}` : null;
    }
  } catch {
    // Invalid URL: fail closed.
  }
  return null;
}
