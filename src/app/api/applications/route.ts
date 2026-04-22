import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';

const baseSchema = z.object({
  type: z.enum(['supplier', 'technician']),
  full_name: z.string().min(2),
  phone: z.string().regex(/^\d{10}$/),
  city: z.string().min(2),
});

const supplierSchema = baseSchema.extend({
  type: z.literal('supplier'),
  vehicle_type: z.enum(['Cycle', 'Bike', 'Auto', 'Mini-truck']),
  cans_capacity: z.number().int().min(1).max(5000),
  upi_id: z.string().min(3),
  bank_account: z.string().optional(),
  ifsc: z.string().optional(),
});

const technicianSchema = baseSchema.extend({
  type: z.literal('technician'),
  skills: z.array(z.enum(['Plumbing', 'RO Install', 'Boring', 'Maintenance'])).min(1),
  experience_years: z.number().int().min(0).max(60),
});

const appSchema = z.union([supplierSchema, technicianSchema]);

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = appSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid application', 422);
  }

  const body = parsed.data;

  // Update applicant profile basics (best-effort).
  await auth.ctx.supabase
    .from('profiles')
    .update({ full_name: body.full_name, phone: body.phone })
    .eq('id', auth.ctx.profile.id);

  const { data: application, error } = await auth.ctx.supabase
    .from('applications')
    .insert({
      user_id: auth.ctx.profile.id,
      type: body.type,
      payload: body,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) return jsonErr(error.message, 502);
  return jsonOk(application, 201);
}

