import { redirect } from 'next/navigation';

// Preserve the historic URL while directing admins to the multi-city console.
export default function LegacyNoidaReadinessPage() {
  redirect('/admin/city-readiness');
}
