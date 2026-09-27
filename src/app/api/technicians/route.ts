import { jsonOk } from '@/lib/api/json-response';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { createServiceClient } from '@/utils/supabase/server';

type ServiceKey = 'water_tanker' | 'ro_service' | 'plumbing' | 'borewell' | 'motor_pump' | 'tank_cleaning';

function guessService(vehicle: string | null, city: string | null): ServiceKey {
  const v = (vehicle ?? '').toLowerCase();
  if (v.includes('ro')) return 'ro_service';
  if (v.includes('bore')) return 'borewell';
  if (v.includes('motor') || v.includes('pump')) return 'motor_pump';
  if (v.includes('tanker')) return 'water_tanker';
  if (v.includes('tank')) return 'tank_cleaning';
  if (city) return 'plumbing';
  return 'plumbing';
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return jsonOk([]);
  }

  try {
    const sb = createSupabaseAnonClient();
    let { data, error } = await sb
      .from('profiles')
      .select('id, full_name, avatar_url, role, is_active, status, city, vehicle_type, license_number')
      .eq('role', 'technician')
      .eq('is_active', true);

    if (error) {
      try {
        const admin = createServiceClient();
        const retry = await admin
          .from('profiles')
          .select('id, full_name, avatar_url, role, is_active, status, city, vehicle_type, license_number')
          .eq('role', 'technician')
          .eq('is_active', true);
        data = retry.data;
        error = retry.error;
      } catch {
        return jsonOk([]);
      }
    }

    if (error) {
      return jsonOk([]);
    }

    const list = (data ?? []).map((row) => {
      const name = (row.full_name || 'Technician').trim() || 'Technician';
      const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((p: string) => p[0]?.toUpperCase() ?? '')
        .join('');
      const skill = row.vehicle_type?.trim() || 'Plumbing';
      return {
        id: row.id,
        name,
        initials,
        avatar_url: row.avatar_url,
        city: row.city || 'Uttar Pradesh',
        skills: [skill],
        rating: 4.8,
        jobs: 0,
        verified: row.status === 'active',
        available: row.status === 'active',
        preferredServiceKey: guessService(row.vehicle_type, row.city),
        speciality: row.license_number ? `License ${row.license_number}` : 'AuroWater technician',
        experience: 'On platform',
      };
    });

    return jsonOk(list);
  } catch {
    return jsonOk([]);
  }
}
