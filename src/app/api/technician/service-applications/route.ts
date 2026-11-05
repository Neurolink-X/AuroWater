import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { consumeRateLimit } from '@/lib/api/rate-limit';
import {
  assessTechnicianServiceRequest,
  requiredDocumentStates,
  isTechnicianServiceKey,
  TECHNICIAN_SERVICE_OPTIONS,
} from '@/lib/technician-service-approval';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  serviceKey: z.enum(['plumbing','ro_service','tank_cleaning','borewell']),
  workingArea: z.string().trim().min(3).max(150),
  workingPincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid six-digit service-area PIN'),
  experienceYears: z.number().int().min(0).max(60),
  workDescription: z.string().trim().min(20, 'Describe your experience in at least 20 characters').max(700),
}).strict();

async function readState(userId: string) {
  const db = createServiceClient();
  const [account, capabilities, pendingApplication, latestApplication, documents] = await Promise.all([
    db.from('profiles').select('id,role,status,is_active,city,full_name,phone')
      .eq('id',userId).maybeSingle(),
    db.from('technician_service_capabilities').select('service_key,status')
      .eq('technician_id',userId).limit(20),
    db.from('applications').select('id,type,status,payload,created_at')
      .eq('user_id',userId).eq('type','technician')
      .in('status',['pending','pending_approval'])
      .order('created_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('applications').select('id,type,status,payload,created_at')
      .eq('user_id',userId).eq('type','technician')
      .order('created_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('user_files').select('document_slot,review_status,created_at')
      .eq('owner_user_id',userId)
      .in('document_slot',['aadhaar_front','aadhaar_back','profile_photo'])
      .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(30),
  ]);
  if (account.error || capabilities.error || pendingApplication.error ||
      latestApplication.error || documents.error)
    throw new Error('APPLICATION_STATE_UNAVAILABLE');
  if (!account.data) throw new Error('ACCOUNT_NOT_FOUND');
  return {
    account: account.data,
    pending: pendingApplication.data,
    recent: latestApplication.data,
    approvedServices: (capabilities.data ?? []).filter(c=>c.status==='approved').map(c=>c.service_key),
    documentStatuses: requiredDocumentStates(documents.data ?? []),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx,'technician')) return jsonErr('Technician account required',403);
  try {
    const state = await readState(auth.ctx.user.id);
    const response = jsonOk({
      city: state.account.city,
      full_name: state.account.full_name,
      account_active: state.account.is_active && state.account.status === 'active',
      documents_approved: ['aadhaar_front','aadhaar_back','profile_photo']
        .every(s => state.documentStatuses[s] === 'approved'),
      approved_services: state.approvedServices,
      pending_application: state.pending && {
        id: state.pending.id, status: state.pending.status,
        requested_role: typeof (state.pending.payload as {role?:unknown}|null)?.role==='string'
          ? (state.pending.payload as {role:string}).role : null,
      },
      recent_application: state.recent && {
        id: state.recent.id, status: state.recent.status,
      },
      options: TECHNICIAN_SERVICE_OPTIONS,
    });
    response.headers.set('Cache-Control','private, no-store');
    return response;
  } catch {
    return jsonErr('Service application status is temporarily unavailable. Please retry.',503);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx,'technician')) return jsonErr('Technician account required',403);
  let raw: unknown;
  try { raw=await req.json(); } catch { return jsonErr('Invalid JSON request',400); }
  const parsed=submitSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid application',422);
  const body=parsed.data;
  if (!isTechnicianServiceKey(body.serviceKey)) return jsonErr('Unsupported service',422);

  const limiter=await consumeRateLimit(createServiceClient(),'technician-service-application',auth.ctx.user.id,8,86400);
  if(limiter.unavailable) return jsonErr('Application safety checks are temporarily unavailable',503);
  if(!limiter.allowed) {
    const res=jsonErr('Too many requests. Please retry later.',429);
    res.headers.set('Retry-After',String(Math.max(1,limiter.retryAfter)));
    return res;
  }
  let state: Awaited<ReturnType<typeof readState>>;
  try { state=await readState(auth.ctx.user.id); }
  catch { return jsonErr('Could not verify your professional account. Retry.',503); }
  const assessed=assessTechnicianServiceRequest({
    account:state.account, serviceKey:body.serviceKey,
    approvedServices:state.approvedServices, pending:state.pending,
    documentStatuses:state.documentStatuses,
  });
  if (!assessed.ok) return jsonErr(assessed.message,assessed.status,assessed.code);
  if (assessed.reused) {
    const response=jsonOk({ application_id: assessed.applicationId, status:'pending', already_submitted:true },200);
    response.headers.set('Cache-Control','private, no-store');
    return response;
  }

  // The database RPC locks the profile, rechecks all prerequisites and inserts
  // the pending application atomically. It NEVER approves an operational role.
  const {data,error}=await createServiceClient().rpc('submit_technician_service_request',{
    p_user_id:auth.ctx.user.id,
    p_service_key:body.serviceKey,
    p_working_area:body.workingArea,
    p_working_pincode:body.workingPincode,
    p_experience_years:body.experienceYears,
    p_work_description:body.workDescription,
  });
  if(error) {
    const validation=error.code==='P0001' || error.code==='23505';
    console.error('[technician-service-application] submission rejected',{code:error.code});
    return jsonErr(validation ? error.message : 'Service application is temporarily unavailable. Please retry.',validation?409:503);
  }
  const response=jsonOk(data,201);
  response.headers.set('Cache-Control','private, no-store');
  // Admin inbox receives an optional alert; never declare failure after persisted write.
  try {
    const db=createServiceClient();
    const record=data as { application_id?:string; already_submitted?:boolean } | null;
    if(record?.application_id && !record.already_submitted) {
      const {data:admins}=await db.from('profiles').select('id').eq('role','admin').eq('is_active',true).limit(20);
      if(admins?.length) {
        await db.from('notifications').upsert(admins.map(a=>({
          user_id:a.id, type:'system',
          title:'Technician service approval requested',
          message:'An existing technician has requested an additional service. Verify skills before approval.',
          data:{application_id:record.application_id,url:'/admin/users'},
          dedup_key:`service_approval_${record.application_id}_${a.id}`, is_read:false,
        })),{onConflict:'dedup_key',ignoreDuplicates:true});
      }
    }
  } catch { /* submission already committed */ }
  return response;
}
