/** Only diagnostic categories and route templates leave the browser. Never raw exceptions. */
export const ERROR_CATALOG = {
  RUNTIME_ERROR: ['Page script failed', 'A browser script failed. Check this page and the matching deployment logs.'],
  UNHANDLED_REJECTION: ['Background operation failed', 'An asynchronous operation failed without recovery. Check the affected page.'],
  CHUNK_LOAD_ERROR: ['App update could not load', 'A JavaScript file could not load. Check deployment assets, connectivity and service-worker compatibility.'],
  API_SERVER_ERROR: ['Server request failed', 'The API returned a server error. Check server/database logs for this route; do not replay uncertain payments or orders.'],
  NETWORK_ERROR: ['Request could not reach server', 'A request failed before receiving a response. Check connectivity, timeouts and service availability.'],
  SERVER_ERROR: ['Server execution failed', 'A server render or route threw an exception. Check deployment logs for the matching route and time.'],
  DATABASE_UNAVAILABLE: ['Database request failed', 'A database/table/permission error interrupted the request. Check database health, migrations and access policies.'],
} as const;
export type PlatformErrorCode = keyof typeof ERROR_CATALOG;
export const ERROR_GROUPS = ['public', 'customer', 'supplier', 'technician', 'admin'] as const;
export type ErrorGroup = typeof ERROR_GROUPS[number];
// Static route vocabulary. Unknown segments (including IDs, names, PINs) are masked.
const SEGMENTS = new Set('about accept account account-help account-recovery addresses admin agent api applications apply assign auth automation availability become-a-supplier blog blog-publish book calculate-price callback cancel careers cities city-readiness confirm contact contact-details cookies coverage coverage-requests create cron customer customers dashboard diagnose dispatch dispatch-queue dispatch-sweep dispatch-work-sweep documents earnings errors expansion feedback files finance forgot-password forward founding-members geo geocode health history home how-it-works inbox intelligence internal job jobs local-demand local-intelligence login logout loyalty me metrics ncr-waitlist nearby-offers news noida-readiness notifications offline operations-health order-health orders otp partner partner-applications payment payments payout-request payouts pending plumber postal postal-intelligence preferred-supplier preview pricing privacy pro profile public push queue-health radius-requests rating read read-all reconfirm referral referral-summary referrals refresh register reject resend-confirmation reset reverse reviews route-plan security seller service-applications service-areas service-cities service-radii serviceability services session settings specializations stats status stock subscriptions success supplier supplier-profile-requests suppliers support technician technician-capabilities technician-dispatch-sweep technician-documents technicians telemetry terms track update-password upload users verification visualizer waitlist water-can water-delivery web-push-sweep web-vitals workflow zones'.split(' '));
export function safeErrorPath(input: unknown): string {
  const raw = String(input ?? '').split(/[?#]/)[0];
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/[unknown]';
  return '/' + raw.split('/').filter(Boolean).slice(0,8).map(part => SEGMENTS.has(part) ? part : '[item]').join('/');
}
export function errorGroup(path: string): ErrorGroup {
  const part = path.replace(/^\/api\//, '/').split('/')[1];
  if (part === 'admin') return 'admin';
  if (part === 'supplier' || part === 'seller') return 'supplier';
  if (part === 'technician' || part === 'agent') return 'technician';
  if (part === 'customer') return 'customer';
  return 'public';
}
export function classifyPlatformError(error: unknown): PlatformErrorCode {
  const value = error && typeof error === 'object' ? error as {message?:unknown;code?:unknown} : {};
  if (/chunkloaderror|loading chunk|failed to fetch dynamically imported module/i.test(String(value.message ?? ''))) return 'CHUNK_LOAD_ERROR';
  if (/^(?:PGRST\d+|42P01|42501|53300|080\w+)$/.test(String(value.code ?? ''))) return 'DATABASE_UNAVAILABLE';
  return 'SERVER_ERROR';
}
export function validatePlatformEvent(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (!Object.hasOwn(ERROR_CATALOG, String(v.code)) || !ERROR_GROUPS.includes(v.group as ErrorGroup)) return null;
  const status = Number(v.status ?? 0);
  if (!Number.isInteger(status) || (status !== 0 && (status < 500 || status > 599))) return null;
  const source = v.source === 'server' ? 'server' : 'browser';
  return { code: v.code as PlatformErrorCode, group: v.group as ErrorGroup, path: safeErrorPath(v.path), status, source };
}
