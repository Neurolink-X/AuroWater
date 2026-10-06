import { redirect } from 'next/navigation';

/**
 * Legacy compatibility route.
 *
 * Plumbing is a technician service/capability, not a separate
 * platform role.
 *
 * Keep this route temporarily so old bookmarks/links do not
 * break, but send the user to the canonical technician workspace.
 */
export default function PlumberDashboard() {
  redirect('/technician/dashboard');
}
