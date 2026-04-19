import { redirect } from 'next/navigation';

/** Legacy `/dashboard` — customer workspace moved to `/customer/home`. */
export default function LegacyDashboardRedirect() {
  redirect('/customer/home');
}
