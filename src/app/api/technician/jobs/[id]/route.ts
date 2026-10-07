import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('technician_id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('Job not found', 404);
  }

  const safe = { ...data } as Record<string, unknown>;
  delete safe.service_otp_hash;
  return jsonOk(safe);
}


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

  let body: {
    status?: string;
    otp?: string;
    payment_confirmed?: boolean;
    payment_reference?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const status = typeof body.status === 'string' ? body.status.toUpperCase() : '';
  if (!['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
    return jsonErr('Invalid status', 400);
  }

  const { data: order, error } = await auth.ctx.supabase
    .from('orders')
    .select('id, technician_id, customer_id, status, service_type_id, payment_status, payment_method, service_otp_verified')
    .eq('id', id)
    .maybeSingle();

  if (error || !order) return jsonErr('Job not found', 404);
  if (order.technician_id !== auth.ctx.profile.id) return jsonErr('Forbidden', 403);

  if (status === 'IN_PROGRESS') {
    if (order.status !== 'ASSIGNED') {
      return jsonErr('Job can only be started from ASSIGNED', 409);
    }

    const { data: accepted, error: acceptError } =
      await auth.ctx.supabase.rpc('start_technician_job', {
        p_order_id: id,
        p_technician_id: auth.ctx.profile.id,
      });

    if (acceptError || !accepted) {
      return jsonErr('Job was already started or reassigned', 409);
    }

    const { data: otp, error: otpError } =
      await auth.ctx.supabase.rpc('create_service_otp', {
        p_order_id: id,
        p_technician_id: auth.ctx.profile.id,
      });

    if (otpError || !otp) {
      return jsonErr('Job started, but service verification could not be prepared', 500);
    }

    if (order.customer_id) {
      try {
        const { createNotification } = await import('@/lib/notifications');
        await createNotification(
          String(order.customer_id),
          'Technician started your service',
          `Please keep service code ${String(otp)} private until the work is ready to be completed.`,
          'booking',
          id,
          'technician_started',
        );
      } catch (notificationError) {
        console.error('[technician/jobs] start notification failed:', notificationError);
      }
    }

    const { data: updated } = await auth.ctx.supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    return jsonOk(updated);
  }

  if (status === 'COMPLETED') {
    if (order.status !== 'IN_PROGRESS') {
      return jsonErr('Job can only be completed from IN_PROGRESS', 409);
    }

    if (!order.service_otp_verified) {
      const otp = typeof body.otp === 'string' ? body.otp.trim() : '';
      if (!/^\d{6}$/.test(otp)) {
        return jsonErr('A valid 6-digit customer service OTP is required', 400);
      }

      const { data: verified, error: otpError } =
        await auth.ctx.supabase.rpc('verify_service_otp', {
          p_order_id: id,
          p_otp: otp,
          p_technician_id: auth.ctx.profile.id,
        });

      if (otpError || !verified) {
        return jsonErr('Invalid service OTP', 403);
      }
    }

    const { data: completed, error: completionError } =
      await auth.ctx.supabase.rpc('complete_technician_job_atomic', {
        p_order_id: id,
        p_technician_id: auth.ctx.profile.id,
        p_payment_confirmed: body.payment_confirmed === true,
        p_payment_reference:
          typeof body.payment_reference === 'string'
            ? body.payment_reference.trim() || null
            : null,
      });

    if (completionError) {
      const message = String(completionError.message ?? '');
      if (message.includes('PAYMENT_CONFIRMATION_REQUIRED')) {
        return jsonErr('Payment confirmation is required before completion', 400);
      }
      if (message.includes('PAYMENT_REFERENCE_REQUIRED')) {
        return jsonErr('UPI payment reference is required', 400);
      }
      if (message.includes('OTP_REQUIRED')) {
        return jsonErr('Service OTP verification is required', 403);
      }
      return jsonErr('Unable to complete the job safely', 409);
    }

    if (!completed) return jsonErr('Job completion failed', 409);

    if (order.customer_id) {
      try {
        const { createNotification } = await import('@/lib/notifications');
        await createNotification(
          String(order.customer_id),
          'Service complete ✅',
          'Your technician has completed the service. You can now review your experience.',
          'booking',
          id,
          'completed',
        );
      } catch (notificationError) {
        console.error('[technician/jobs] completion notification failed:', notificationError);
      }
    }

    const { data: updated } = await auth.ctx.supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    return jsonOk(updated);
  }

  if (!['ASSIGNED', 'IN_PROGRESS'].includes(String(order.status).toUpperCase())) {
    return jsonErr('Job cannot be cancelled in its current state', 409);
  }

  const { data: cancelled, error: cancelError } = await auth.ctx.supabase
    .from('orders')
    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('technician_id', auth.ctx.profile.id)
    .in('status', ['ASSIGNED', 'IN_PROGRESS'])
    .select('*')
    .maybeSingle();

  if (cancelError || !cancelled) {
    return jsonErr('Unable to cancel this job safely', 409);
  }

  if (order.customer_id) {
    try {
      const { createNotification } = await import('@/lib/notifications');
      await createNotification(
        String(order.customer_id),
        'Service update',
        'Your technician could not continue this job. Support may arrange the next step.',
        'booking',
        id,
        'technician_cancelled',
      );
    } catch (notificationError) {
      console.error('[technician/jobs] cancellation notification failed:', notificationError);
    }
  }

  return jsonOk(cancelled);
}
