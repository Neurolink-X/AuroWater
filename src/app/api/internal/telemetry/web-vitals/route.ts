import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_METRICS = new Set(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);
const ALLOWED_GROUPS = new Set(['customer', 'supplier', 'technician', 'admin', 'public']);
const API_BUDGETS: Record<string, number> = {
  customer_order_detail: 600,
  supplier_orders: 800,
  technician_jobs: 800,
  admin_dashboard: 1000,
};
const BUDGETS: Record<string, number> = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
  FCP: 1800,
  TTFB: 800,
};

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return new NextResponse(null, { status: 403 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 2048) return new NextResponse(null, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
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
  const kind = metric.kind === 'api' ? 'api' : 'web-vital';
  const apiGroup = String(metric.api_group ?? '');
  const statusClass = String(metric.status_class ?? '');
  const metricAllowed = kind === 'api'
    ? name === 'API' && Object.hasOwn(API_BUDGETS, apiGroup) && ['2xx', '4xx', '5xx'].includes(statusClass)
    : ALLOWED_METRICS.has(name) && ['good', 'needs-improvement', 'poor'].includes(rating);

  if (!metricAllowed || !ALLOWED_GROUPS.has(group) ||
      !Number.isFinite(value) || value < 0 || value > 60_000) {
    return new NextResponse(null, { status: 400 });
  }

  const budget = kind === 'api' ? API_BUDGETS[apiGroup] : BUDGETS[name];
  const event = {
    event: kind === 'api' ? 'aurotap.api_latency' : 'aurotap.web_vital',
    metric: name,
    ...(kind === 'api' ? { api_group: apiGroup, status_class: statusClass } : { rating, navigation_type: navigationType.slice(0, 32) }),
    value,
    route_group: group,
    budget_ms_or_score: budget,
    budget_exceeded: value > budget,
    timestamp: new Date().toISOString(),
  };

  // Vercel captures stdout. No URL, IP, account ID, order ID or payload is logged.
  process.stdout.write(`[AuroTap Web Vitals] ${JSON.stringify(event)}\\n`);
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}
