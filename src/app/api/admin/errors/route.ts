import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { ERROR_CATALOG, ERROR_GROUPS } from '@/lib/observability/platform-errors';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return NextResponse.json({error:'Forbidden'},{status:403});
  const page = Number(req.nextUrl.searchParams.get('page') ?? 0);
  const group = req.nextUrl.searchParams.get('group') ?? '';
  if (!Number.isSafeInteger(page) || page < 0 || page > 1000 || (group && !ERROR_GROUPS.includes(group as typeof ERROR_GROUPS[number]))) return NextResponse.json({error:'Invalid filter'},{status:400});
  let query = createServiceClient().from('platform_errors')
    .select('id,code,route_group,route_path,http_status,source,occurrences,first_seen,last_seen')
    .gte('last_seen',new Date(Date.now()-30*86400000).toISOString());
  if (group) query = query.eq('route_group',group);
  const {data,error} = await query.order('last_seen',{ascending:false}).order('id',{ascending:false}).range(page*40,page*40+40).abortSignal(AbortSignal.timeout(5000));
  if (error) return NextResponse.json({error:'Error history unavailable. Check the platform-errors migration and database connection.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  const rows = data ?? [];
  return NextResponse.json({data:{page,has_more:rows.length>40,events:rows.slice(0,40).map(row=>({
    ...row, title:ERROR_CATALOG[row.code as keyof typeof ERROR_CATALOG]?.[0] ?? 'Platform issue',
    guidance:ERROR_CATALOG[row.code as keyof typeof ERROR_CATALOG]?.[1] ?? 'Check server logs.',
  }))}},{headers:{'Cache-Control':'private, no-store'}});
}
