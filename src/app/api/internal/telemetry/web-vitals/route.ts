import { NextRequest, NextResponse } from 'next/server';
import { WEB_VITALS_BUDGETS } from '@/lib/observability/performance-budgets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_METRICS = new Set(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);
const ALLOWED_GROUPS = new Set(['customer', 'supplier', 'technician', 'admin', 'public']);
const API_BUDGETS: Record<string, number> = {
  customer_order_detail: WEB_VITALS_BUDGETS.API_CUSTOMER_ORDER.target,
  supplier_orders: WEB_VITALS_BUDGETS.API_SUPPLIER_ORDERS.target,
  technician_jobs: WEB_VITALS_BUDGETS.API_TECHNICIAN_JOBS.target,
  admin_dashboard: WEB_VITALS_BUDGETS.API_ADMIN_DASHBOARD.target,
};
const BUDGETS: Record<string, number> = {
  LCP: WEB_VITALS_BUDGETS.LCP.target,
  INP: WEB_VITALS_BUDGETS.INP.target,
  CLS: WEB_VITALS_BUDGETS.CLS.target,
  FCP: WEB_VITALS_BUDGETS.FCP.target,
  TTFB: WEB_VITALS_BUDGETS.TTFB.target,
};

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return new NextResponse(null, { status: 403 });
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return new NextResponse(null, { status: 403 });

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 2048) return new NextResponse(null, { status: 413 });
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (!body || typeof body !== 'object') return new NextResponse(null, { status: 400 });
  const metric = body as Record<string, unknown>;
  const name = String(metric.name ?? '');
  const group = String(metric.route_group ?? '');
  const value = Number(metric.value);
  const rating = String(metric.rating ?? '');
  const navigationType = String(metric.navigation_type ?? 'unknown');
  const kind = metric.kind === 'api' ? 'api' : metric.kind === 'scroll' ? 'scroll' : 'web-vital';
  const apiGroup = String(metric.api_group ?? '');
  const statusClass = String(metric.status_class ?? '');
  const metricAllowed = kind === 'api'
    ? name === 'API' && Object.hasOwn(API_BUDGETS, apiGroup) && ['2xx', '4xx', '5xx'].includes(statusClass)
    : kind === 'scroll'
      ? name === 'SCROLL_LONG_TASK'
      : ALLOWED_METRICS.has(name) && ['good', 'needs-improvement', 'poor'].includes(rating);

  if (!metricAllowed || !ALLOWED_GROUPS.has(group) ||
      !Number.isFinite(value) || value < 0 || value > 60_000) {
    return new NextResponse(null, { status: 400 });
  }

  const budget = kind === 'api' ? API_BUDGETS[apiGroup] : kind === 'scroll' ? 50 : BUDGETS[name];
  const event = {
    event: kind === 'api' ? 'aurotap.api_latency' : kind === 'scroll' ? 'aurotap.scroll_stall' : 'aurotap.web_vital',
    metric: name,
    ...(kind === 'api' ? { api_group: apiGroup, status_class: statusClass, coalesced: metric.coalesced === true } : kind === 'scroll' ? {} : { rating, navigation_type: navigationType.slice(0, 32) }),
    value,
    route_group: group,
    budget_ms_or_score: budget,
    budget_exceeded: value > budget,
    timestamp: new Date().toISOString(),
  };

  // Vercel captures stdout. No URL, IP, account ID, order ID or payload is logged.
  process.stdout.write(`[AuroTap Web Vitals] ${JSON.stringify(event)}\n`);
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}
