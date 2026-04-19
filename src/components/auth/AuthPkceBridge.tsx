'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Supabase email-confirm / OAuth (PKCE) may redirect to the Site URL with `?code=`.
 * Session exchange runs in `/auth/callback` — forward when the user lands on `/` or another page.
 */
export default function AuthPkceBridge() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const hasImplicitHash =
      window.location.hash.length > 1 &&
      /access_token|refresh_token|type=/.test(window.location.hash);
    if (!code && !hasImplicitHash) return;
    if (pathname?.startsWith('/auth/callback')) return;

    router.replace(`/auth/callback${window.location.search}${window.location.hash}`);
  }, [pathname, router]);

  return null;
}
