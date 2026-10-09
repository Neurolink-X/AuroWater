import { createServiceClient } from '@/utils/supabase/server';

type Row = Record<string, unknown>;

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Row
    : {};
}

function cleanOrder(row: Row): Row {
  const safe = { ...row };
  // A technician must receive the customer's OTP from the customer, not from
  // the order API response.
  delete safe.otp;
  delete safe.service_otp;
  delete safe.service_otp_hash;
  return safe;
}

function noteSlot(row: Row): string {
  const note = String(row.note ?? row.notes ?? '');
  return note.match(/(?:^|\|\s*)Slot:\s*([^|]+)/i)?.[1]?.trim() ?? '';
}

function addressFields(row: Row) {
  const snapshot = asRecord(row.address_snapshot);
  const houseNo = String(snapshot.house_flat ?? snapshot.house_no ?? snapshot.house ?? '');
  const area = String(snapshot.area ?? snapshot.locality ?? snapshot.landmark ?? '');
  const city = String(snapshot.city ?? row.city ?? '');
  const pincode = String(snapshot.pincode ?? '');
  const address = String(
    row.address ??
    snapshot.formatted_address ??
    snapshot.full_address ??
    [houseNo, area, city, pincode].filter(Boolean).join(', ')
  );
  return { house_no: houseNo, area, city, address, address_snapshot: snapshot };
}

export async function enrichTechnicianOrders(rows: Row[]): Promise<Row[]> {
  if (rows.length === 0) return [];

  const service = createServiceClient();
  const customerIds = [...new Set(rows.map((row) => String(row.customer_id ?? '')).filter(Boolean))];
  const serviceTypeIds = [...new Set(rows.map((row) => Number(row.service_type_id)).filter((id) => Number.isInteger(id) && id > 0))];
  const orderIds = [...new Set(rows.map((row) => String(row.id ?? '')).filter(Boolean))];
  const technicianIds = [...new Set(rows.map((row) => String(row.technician_id ?? '')).filter(Boolean))];

  const [profilesResult, serviceTypesResult, dispatchResult] = await Promise.all([
    customerIds.length
      ? service.from('profiles').select('id, full_name, phone, city').in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    serviceTypeIds.length
      ? service.from('service_types').select('id, key, name').in('id', serviceTypeIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length && technicianIds.length
      ? service.from('technician_job_dispatch').select('order_id, technician_id, status').in('order_id', orderIds).in('technician_id', technicianIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    throw new Error('Unable to load customer contact details');
  }

  const profiles = new Map(
    (profilesResult.data ?? []).map((profile) => [String(profile.id), profile]),
  );
  const serviceTypes = new Map(
    (serviceTypesResult.data ?? []).map((item) => [Number(item.id), item]),
  );
  const dispatchByOrderId = new Map(
    (dispatchResult.data ?? []).map((item) => [String(item.order_id), String(item.status ?? '').toUpperCase()]),
  );

  return rows.map((source) => {
    const row = cleanOrder(source);
    const customer = profiles.get(String(row.customer_id ?? ''));
    const serviceType = serviceTypes.get(Number(row.service_type_id));
    const address = addressFields(row);
    const dbStatus = String(row.status ?? 'PENDING').toUpperCase();
    const dispatchStatus = dispatchByOrderId.get(String(row.id ?? ''));
    const displayStatus = dbStatus === 'ASSIGNED'
      ? (row.accepted_at || dispatchStatus === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING')
      : dbStatus === 'IN_PROGRESS'
        ? 'WORKING'
        : dbStatus === 'CANCELLED'
          ? 'REJECTED'
          : dbStatus;
    const scheduled = row.scheduled_date ?? row.scheduled_at ?? row.scheduled_time ?? null;
    const scheduledDate = row.scheduled_date
      ? String(row.scheduled_date)
      : scheduled
        ? new Date(String(scheduled)).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        : '';

    return {
      ...row,
      status: displayStatus,
      service_name: String(row.service_type ?? row.service_type_key ?? serviceType?.name ?? serviceType?.key ?? 'Service'),
      customer_name: String(customer?.full_name ?? '—'),
      customer_phone: String(customer?.phone ?? ''),
      customer_city: customer?.city ?? null,
      total_amount: Number(row.final_amount ?? row.total_amount ?? row.amount ?? 0),
      time_slot: String(row.time_slot ?? row.scheduled_slot ?? noteSlot(row)),
      scheduled_date: scheduledDate,
      assigned_at: String(row.assigned_at ?? row.accepted_at ?? row.created_at ?? ''),
      ...address,
    };
  });
}

export function safeTechnicianOrder(row: Row): Row {
  return cleanOrder(row);
}
