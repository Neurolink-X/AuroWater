import { redirect } from 'next/navigation';

/** Customer settings live on the account screen until the tabbed /settings UI is fully wired. */
export default function SettingsRedirect() {
  redirect('/customer/account');
}
