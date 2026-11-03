/**
 * Logout privacy: revoke only this browser subscription, never all other
 * devices. This module is dynamically imported only when signing out.
 */
export async function revokeLocalPushBeforeLogout(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch('/api/notifications/push', {
          method: 'POST',
          keepalive: true,
          cache: 'no-store',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'unsubscribe', endpoint: subscription.endpoint,
          }),
          signal: AbortSignal.timeout(400),
        });
      }
    } catch {
      // Even without network, local unsubscribe prevents future browser alerts.
    } finally {
      await subscription.unsubscribe().catch(() => undefined);
    }
  } catch {
    // Logout must never fail because of optional browser notifications.
  }
}
