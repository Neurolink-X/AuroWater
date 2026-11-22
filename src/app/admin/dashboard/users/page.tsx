import { redirect } from 'next/navigation';

/** Legacy approvals links use the single maintained Users/approvals workflow. */
export default async function LegacyApprovals({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const input = await searchParams;
  const query = new URLSearchParams();
  query.set('view', typeof input.view === 'string' && ['pending','all','suspended'].includes(input.view) ? input.view : 'pending');
  for (const key of ['role','q','page']) if (typeof input[key] === 'string') query.set(key,input[key]);
  redirect(`/admin/users?${query.toString()}`);
}
