/* ─────────────────────────────────────────────
   Shared connection helpers (browser only).
   Used by RetryButton.tsx and OfflineClient.tsx, so the logic lives in one place.
───────────────────────────────────────────── */

/* A real network test.
   navigator.onLine can say "online" on Wi-Fi that has no internet, so we ask the server.
   - The ping address is different every time, so a saved copy can never fool us.
   - We check the answer is JSON, so an "offline page" reply is not mistaken for success. */
export async function reallyOnline(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`/manifest.webmanifest?ping=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    return res.ok && (res.headers.get('content-type') || '').includes('json');
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/* Send the customer back into the app.
   The browser keeps the address they asked for, so a reload brings them to THAT page.
   If they opened /offline directly (for example from the app icon), send them home instead. */
export function returnToApp(): void {
  if (window.location.pathname.startsWith('/offline')) window.location.replace('/');
  else window.location.reload();
}
