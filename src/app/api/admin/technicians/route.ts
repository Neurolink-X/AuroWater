import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

export type TechnicianRow = {
  id: string;
  full_name: string | null;
  is_online: boolean | null;
  phone: string | null;
  active_jobs: number;
  stats: { active: number; done: number };
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { data: techs, error } = await auth.ctx.supabase
    .from('profiles')
    .select('id, full_name, is_online, phone')
    .eq('role', 'technician')
    .order('is_online', { ascending: false })
    .order('full_name', { ascending: true });

  if (error) {
    return jsonErr(error.message, 500);
  }

  const ids = (techs ?? []).map((t) => t.id);
  const stats: Record<string, { active: number; done: number }> = {};
  for (const id of ids) {
    stats[id] = { active: 0, done: 0 };
  }

  if (ids.length) {
    const { data: jobs } = await auth.ctx.supabase
      .from('orders')
      .select('technician_id, status')
      .in('technician_id', ids);

    for (const j of jobs ?? []) {
      const tid = j.technician_id as string;
      if (!tid || !stats[tid]) continue;
      const st = String(j.status);
      if (st === 'COMPLETED') {
        stats[tid].done += 1;
      } else if (st === 'ASSIGNED' || st === 'IN_PROGRESS') {
        stats[tid].active += 1;
      }
    }
  }

  const out: TechnicianRow[] = (techs ?? []).map((t) => {
    const s = stats[t.id] ?? { active: 0, done: 0 };
    return {
      id: t.id,
      full_name: t.full_name,
      is_online: t.is_online,
      phone: t.phone,
      active_jobs: s.active,
      stats: s,
    };
  });

  return jsonOk(out);
}
