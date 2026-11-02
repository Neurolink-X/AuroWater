import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';
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
const SUPPORTED_SERVICES = new Set(['plumbing','ro_service','borewell','motor_pump','tank_cleaning','installation','maintenance']);

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  // For service-specific assignment, return only approved specialists.
  // Never fall back to the entire technician roster on a capability query error.
  const serviceKey = req.nextUrl.searchParams.get('service_key') ?? '';
  if (serviceKey && !SUPPORTED_SERVICES.has(serviceKey)) return jsonErr('Unsupported technician service.', 422);
  let approvedIds: string[] | null = null;
  if (serviceKey) {
    const { data: approved, error: approvalError } = await createServiceClient()
      .from('technician_service_capabilities')
      .select('technician_id').eq('service_key', serviceKey).eq('status', 'approved').limit(500);
    if (approvalError) return jsonErr('Could not verify specialists. Assignment remains unchanged.', 503);
    approvedIds = (approved ?? []).map(item => String(item.technician_id));
    if (!approvedIds.length) return jsonOk([]);
  }

  let query = auth.ctx.supabase.from('profiles')
    .select('id, full_name, is_online, phone')
    .eq('role', 'technician')
    .order('is_online', { ascending: false, nullsFirst: false })
    .order('full_name', { ascending: true, nullsFirst: true });
  if (approvedIds !== null) query = query.in('id', approvedIds).eq('is_active', true).eq('status', 'active')
    .eq('verification_status', 'approved');
  const { data: techs, error: techError } = await query;

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
