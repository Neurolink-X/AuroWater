'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * PKCE `?code=` is exchanged on `/auth/callback`.
 * Recovery links often arrive as a hash (`#access_token&type=recovery`) which
 * the server callback cannot see — keep those on a client page.
 */
export default function AuthPkceBridge() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname?.startsWith('/auth/callback')) return;
    if (pathname?.startsWith('/auth/update-password')) return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const type = url.searchParams.get('type');
    const tokenHash = url.searchParams.get('token_hash');
    const hash = window.location.hash;
    const hashRecovery = hash.length > 1 && /type=recovery|access_token/.test(hash);

    if (hashRecovery && !code) {
      router.replace(`/auth/update-password${hash}`);
      return;
    }

    if (tokenHash && (type === 'recovery' || type === 'magiclink')) {
      const q = new URLSearchParams({ token_hash: tokenHash, type, next: '/auth/update-password' });
      router.replace(`/auth/callback?${q.toString()}`);
      return;
    }

    if (code) {
      const next = type === 'recovery' ? '/auth/update-password' : url.searchParams.get('next') || '';
      const q = new URLSearchParams({ code });
      if (next) q.set('next', next);
      router.replace(`/auth/callback?${q.toString()}`);
    }
  }, [pathname, router]);

  return null;
}
