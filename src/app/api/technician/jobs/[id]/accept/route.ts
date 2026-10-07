import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  const { data: order, error: lookupError } = await auth.ctx.supabase
    .from('orders')
    .select('id, technician_id, status, customer_id, service_type_id')
    .eq('id', id)
    .maybeSingle();

  if (lookupError || !order) {
    return jsonErr('Job not found', 404);
  }
  if (order.technician_id !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }
  if (order.status !== 'ASSIGNED') {
    return jsonErr('Job cannot be accepted in current status', 409);
  }

  const { data: accepted, error: acceptError } =
    await auth.ctx.supabase.rpc('accept_technician_job', {
      p_order_id: id,
      p_technician_id: auth.ctx.profile.id,
    });

  if (acceptError) {
    console.error('[technician/accept] atomic accept failed:', acceptError);
    return jsonErr('Unable to accept this job right now', 409);
  }

  if (!accepted) {
    return jsonErr('Job was already accepted or reassigned', 409);
  }

  // Generate the one-time service completion proof only after the technician
  // has atomically started the job. The plaintext is never stored in the DB.
  const { data: otp, error: otpError } =
    await auth.ctx.supabase.rpc('create_service_otp', {
      p_order_id: id,
      p_technician_id: auth.ctx.profile.id,
    });

  if (otpError || !otp) {
    console.error('[technician/accept] OTP creation failed:', otpError);
    return jsonErr('Job started, but service verification could not be prepared', 500);
  }

  const customerId = order.customer_id != null ? String(order.customer_id) : '';
  let serviceName = 'service';

  if (order.service_type_id != null) {
    const { data: st } = await auth.ctx.supabase
      .from('service_types')
      .select('name')
      .eq('id', order.service_type_id)
      .maybeSingle();
    if (st?.name) serviceName = String(st.name);
  }

  if (customerId) {
    try {
      const { createNotification } = await import('@/lib/notifications');
      await createNotification(
        customerId,
        'Technician has started your service',
        `Your ${serviceName} visit has started. Share service code ${String(otp)} with the technician only when the work is ready to be completed.`,
        'booking',
        id,
        'technician_started',
      );
    } catch (error) {
      console.error('[technician/accept] notification failed:', error);
    }
  }

  return jsonOk({
    accepted: true,
    status: 'IN_PROGRESS',
    otp_created: true,
  });
}

