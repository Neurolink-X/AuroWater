// PATH: src/app/api/files/route.ts
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { slotsForRole } from '@/lib/private-file-validation';

export const dynamic = 'force-dynamic';

/** The signed-in user's own files + the document slots their role must provide. Powers the uploader UI. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const db = createServiceClient();
  const { data, error } = await db.from('user_files')
    .select('id, category, document_slot, original_name, content_type, size_bytes, review_status, review_note, created_at, reviewed_at')
    .eq('owner_user_id', auth.ctx.user.id).order('created_at', { ascending: false }).limit(200);
  if (error) {
    console.error('[files/list] lookup failed', error);
    return jsonErr('Could not load your documents.', 503);
  }
  // A new professional initially has a customer profile. Allow only an existing,
  // authenticated pending technician applicant to see the pre-approval KYC slots.
  let slots = slotsForRole(auth.ctx.profile.role);
  let onboardingRole = auth.ctx.profile.role;
  if (auth.ctx.profile.role === 'customer') {
    const { data: pending, error: pendingError } = await db.from('applications')
      .select('id').eq('user_id', auth.ctx.user.id).eq('type', 'technician')
      .in('status', ['pending', 'pending_approval']).limit(1).maybeSingle();
    if (pendingError) return jsonErr('Could not verify application eligibility.', 503);
    if (pending) {
      slots = slotsForRole('technician');
      onboardingRole = 'technician_applicant';
    }
  }
  const res = jsonOk({ role: onboardingRole, slots, files: data ?? [] });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
