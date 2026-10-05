import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireAdmin,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

export type TechnicianRow = {
  id: string;
  full_name: string | null;
  is_online: boolean | null;
  phone: string | null;
  active_jobs: number;
  stats: {
    active: number;
    done: number;
  };
};

const ACTIVE_JOB_STATUSES = new Set([
  'ASSIGNED',
  'IN_PROGRESS',
]);

const COMPLETED_STATUS = 'COMPLETED';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { data: techs, error: techError } =
    await auth.ctx.supabase
      .from('profiles')
      .select('id, full_name, is_online, phone')
      .eq('role', 'technician')
      .order('is_online', {
        ascending: false,
        nullsFirst: false,
      })
      .order('full_name', {
        ascending: true,
        nullsFirst: true,
      });

  if (techError) {
    return jsonErr(techError.message, 502);
  }

  const technicians = techs ?? [];

  if (!technicians.length) {
    return jsonOk([]);
  }

  const ids = technicians.map((tech) => String(tech.id));

  const stats = new Map<
    string,
    { active: number; done: number }
  >();

  for (const id of ids) {
    stats.set(id, {
      active: 0,
      done: 0,
    });
  }

  /*
   * One orders query for all technicians.
   * This avoids the N+1 query problem.
   */
  const { data: jobs, error: jobsError } =
    await auth.ctx.supabase
      .from('orders')
      .select('technician_id, status')
      .in('technician_id', ids);

  if (jobsError) {
    return jsonErr(jobsError.message, 502);
  }

  for (const job of jobs ?? []) {
    const technicianId =
      job.technician_id != null
        ? String(job.technician_id)
        : '';

    const technicianStats =
      stats.get(technicianId);

    if (!technicianStats) {
      continue;
    }

    const status = String(job.status ?? '').toUpperCase();

    if (status === COMPLETED_STATUS) {
      technicianStats.done += 1;
      continue;
    }

    if (ACTIVE_JOB_STATUSES.has(status)) {
      technicianStats.active += 1;
    }
  }

  const result: TechnicianRow[] =
    technicians.map((tech) => {
      const id = String(tech.id);

      const technicianStats =
        stats.get(id) ?? {
          active: 0,
          done: 0,
        };

      return {
        id,
        full_name:
          tech.full_name != null
            ? String(tech.full_name)
            : null,
        is_online:
          tech.is_online != null
            ? Boolean(tech.is_online)
            : null,
        phone:
          tech.phone != null
            ? String(tech.phone)
            : null,
        active_jobs:
          technicianStats.active,
        stats: {
          active:
            technicianStats.active,
          done:
            technicianStats.done,
        },
      };
    });

  return jsonOk(result);
}
