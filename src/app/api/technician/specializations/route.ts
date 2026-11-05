import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * A professional sees only their own approved capabilities and submitted application.
 * Service-role reads are never exposed without server-authenticated user ID ownership.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) return jsonErr('Technician access required.', 403);

  const id = auth.ctx.profile.id;
  const db = createServiceClient();
  const [capabilities, applications, documents] = await Promise.all([
    db.from('technician_service_capabilities')
      .select('service_key,status,reviewed_at')
      .eq('technician_id', id).order('service_key', { ascending: true }).limit(20),
    db.from('applications')
      .select('id,status,created_at,payload,rejection_note')
      .eq('user_id', id).eq('type', 'technician')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('user_files')
      .select('document_slot,review_status')
      .eq('owner_user_id', id)
      .in('document_slot', ['aadhaar_front','aadhaar_back','profile_photo'])
      .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(30),
  ]);

  if (capabilities.error || applications.error || documents.error) {
    console.error('[technician/specializations] private read unavailable', {
      capabilityCode: capabilities.error?.code,
      applicationCode: applications.error?.code,
      documentCode: documents.error?.code,
    });
    return jsonErr('Service approvals are temporarily unavailable; jobs remain protected.', 503);
  }

  // Document approval, account verification and service skill approval are separate.
  // A completed KYC upload must not silently grant permissions or activate dispatch.
  const newest = new Map<string,string>();
  for(const row of documents.data ?? []) {
    if(row.document_slot && !newest.has(row.document_slot)) newest.set(row.document_slot, row.review_status);
  }
  const required = ['aadhaar_front','aadhaar_back','profile_photo'];
  const docsApproved = required.every(slot=>newest.get(slot)==='approved');
  const docsSubmitted = required.every(slot=>newest.has(slot));
  const docsRejected = required.some(slot=>newest.get(slot)==='rejected');
  const documentStatus = docsApproved?'approved':docsRejected?'rejected':docsSubmitted?'under_review':'not_submitted';
  const application = applications.data;
  const proposed = application?.payload && typeof application.payload === 'object' && !Array.isArray(application.payload)
    ? application.payload as Record<string, unknown> : null;
  const response = jsonOk({
    documents: { status: documentStatus, approved_count: required.filter(s=>newest.get(s)==='approved').length, required_count: 3 },
    profile: {
      city: auth.ctx.profile.city ?? null,
      email: auth.ctx.user.email ?? auth.ctx.profile.email ?? null,
      verification: auth.ctx.profile.verification_status ?? null,
      active: auth.ctx.profile.is_active === true && auth.ctx.profile.status === 'active',
    },
    approved: (capabilities.data ?? []).filter(x => x.status === 'approved').map(x => ({
      service_key: x.service_key, reviewed_at: x.reviewed_at,
    })),
    other_capabilities: (capabilities.data ?? []).filter(x => x.status !== 'approved').map(x => ({
      service_key: x.service_key, status: x.status,
    })),
    application: application ? {
      id: application.id, status: application.status, created_at: application.created_at,
      requested_role: typeof proposed?.role === 'string' ? proposed.role : null,
      rejection_note: application.rejection_note ?? null,
    } : null,
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
