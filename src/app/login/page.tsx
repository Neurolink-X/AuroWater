import { redirect } from 'next/navigation';

/** Legacy entry point kept only for existing links and bookmarks. */
export default function LegacyLoginPage() {
  redirect('/auth/login');
}
