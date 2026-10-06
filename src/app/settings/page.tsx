import { redirect } from 'next/navigation';

/**
 * Legacy settings route.
 *
 * The canonical account/settings experience currently lives
 * under the customer account area.
 *
 * Keep this route as a compatibility entry point so existing
 * bookmarks and navigation links do not break.
 *
 * IMPORTANT:
 * Do not add role-management or security-sensitive logic here.
 * Role/status/verification changes must always be handled by
 * dedicated authenticated APIs and admin workflows.
 */
export default function SettingsRedirect() {
  redirect('/customer/account');
}
