// 'use client';

// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from 'react';
// import { useRouter } from 'next/navigation';
// import { createClient } from '@/lib/supabase/client';
// import { toast } from 'sonner';
// import {
//   supplierOrderAccept,
//   supplierOrderUpdateStatus,
//   supplierOrdersList,
//   supplierStockGet,
//   supplierStockUpdate,
//   supplierSettingsGet,
//   supplierSettingsUpdate,
//   supplierEarningsSummary,
//   supplierRatingGet,
// } from '@/lib/api-client';
// import { useSupplierRealtime } from '@/hooks/useSupplierRealtime';

// // ─── Types ───────────────────────────────────────────────────

// type SupplierProfile = {
//   id: string;
//   user_id: string;
//   full_name: string;
//   phone: string;
//   city: string;
//   tier: 'bronze' | 'silver' | 'gold' | 'platinum';
//   is_active: boolean;
//   is_verified: boolean;
//   total_deliveries: number;
//   total_earnings: number;
//   rating: number;
//   rating_count: number;
//   created_at: string;
// };

// type OrderStatus =
//   | 'pending'
//   | 'assigned'
//   | 'in_progress'
//   | 'delivered'
//   | 'cancelled';

// type Order = {
//   id: string;
//   booking_id: string;
//   service_type: string;
//   customer_name: string;
//   customer_phone: string;
//   address_line: string;
//   city: string;
//   scheduled_date: string;
//   scheduled_slot: string;
//   status: OrderStatus;
//   amount: number;
//   cans_count: number | null;
//   notes: string | null;
//   created_at: string;
//   accepted_at?: string | null;
//   payment_method?: string | null;
//   payment_status?: string | null;
// };

// type EarningRow = {
//   id: string;
//   order_id: string;
//   amount: number;
//   status: 'pending' | 'paid' | 'review';
//   paid_at: string | null;
//   created_at: string;
// };

// type Notification = {
//   id: string;
//   title: string;
//   body: string;
//   is_read: boolean;
//   created_at: string;
// };

// type DashboardStats = {
//   todayOrders: number;
//   pendingOrders: number;
//   weekEarnings: number;
//   monthEarnings: number;
//   completionRate: number;
//   avgRating: number;
// };

// type SupplierStockState = {
//   supplier_id: string;
//   cans_available: number;
//   reserved_cans: number;
//   low_stock_alert: number;
//   reservation_buffer_cans: number;
//   updated_at: string;
// };


// // ─── Constants ────────────────────────────────────────────────────────────────
// // Colours are tuned for the light "water" surface (text colours keep ≥4.5:1 contrast).

// const TIER_META: Record<
//   SupplierProfile['tier'],
//   { label: string; color: string; bg: string; next: string; target: number }
// > = {
//   bronze: { label: 'Bronze', color: '#9A5B13', bg: 'rgba(205,127,50,0.16)', next: 'Silver', target: 50 },
//   silver: { label: 'Silver', color: '#566579', bg: 'rgba(100,116,139,0.16)', next: 'Gold', target: 150 },
//   gold: { label: 'Gold', color: '#A16207', bg: 'rgba(234,179,8,0.20)', next: 'Platinum', target: 400 },
//   platinum: { label: 'Platinum', color: '#3B5B7A', bg: 'rgba(59,91,122,0.16)', next: '—', target: 400 },
// };

// const STATUS_META: Record<
//   OrderStatus,
//   { label: string; color: string; bg: string }
// > = {
//   pending: { label: 'Pending', color: '#9A5A06', bg: 'rgba(245,158,11,0.18)' },
//   assigned: { label: 'Assigned', color: '#0369A1', bg: 'rgba(14,165,233,0.16)' },
//   in_progress: { label: 'In Progress', color: '#6D28D9', bg: 'rgba(124,58,237,0.14)' },
//   delivered: { label: 'Delivered', color: '#047857', bg: 'rgba(16,185,129,0.16)' },
//   cancelled: { label: 'Cancelled', color: '#B91C1C', bg: 'rgba(239,68,68,0.14)' },
// };

// const INR = (n: number) =>
//   `₹${Math.round(n).toLocaleString('en-IN')}`;

// const fmtDate = (iso: string) => {
//   const d = new Date(iso);
//   if (!iso || Number.isNaN(d.getTime())) return 'Date TBD';
//   return d.toLocaleDateString('en-IN', {
//     timeZone: 'Asia/Kolkata',
//     day: '2-digit',
//     month: 'short',
//     year: 'numeric',
//   });
// };

// // Epoch ms for any timestamp-ish value (0 when unusable) — safe for rolling-window comparisons.
// const toMs = (value: unknown) => {
//   const t = Date.parse(String(value ?? '').replace(' ', 'T'));
//   return Number.isNaN(t) ? 0 : t;
// };

// const fmtTime = (iso: string) => {
//   const d = new Date(iso);
//   if (!iso || Number.isNaN(d.getTime())) return '';
//   return d.toLocaleTimeString('en-IN', {
//     timeZone: 'Asia/Kolkata',
//     hour: '2-digit',
//     minute: '2-digit',
//     hour12: true,
//   });
// };

// // Database timestamps can arrive as ISO strings (often UTC). Always display
// // those in India Standard Time; preserve human-entered labels such as "Morning".
// const formatScheduledSlot = (value: string) => {
//   const raw = String(value ?? '').trim();
//   if (!raw) return 'Time not specified';
//   if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
//     const formatted = fmtTime(raw);
//     return formatted || 'Time not specified';
//   }
//   return raw;
// };

// // Normalize date-only values without shifting them. Convert timestamps to India-local dates.
// const toISTDateKey = (value: unknown): string => {
//   const raw = String(value ?? '').trim();
//   if (!raw) return '';
//   if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
//   const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
//   const normalized = !hasTimezone && /^\d{4}-\d{2}-\d{2}[T ]/.test(raw)
//     ? `${raw.replace(' ', 'T')}+05:30`
//     : raw;
//   const date = new Date(normalized);
//   if (Number.isNaN(date.getTime())) return '';
//   return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
// };
// const todayIST = () => toISTDateKey(new Date().toISOString());
// const tomorrowIST = () => {
//   const [year, month, day] = todayIST().split('-').map(Number);
//   if (!year || !month || !day) return '';
//   return toISTDateKey(new Date(Date.UTC(year, month - 1, day + 1, 12)).toISOString());
// };
// const exportEarningsCsv = (rows: EarningRow[]) => {
//   if (!rows.length) return false;
//   const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
//   const lines = [
//     ['Order ID', 'Amount INR', 'Payout status', 'Created at', 'Paid at'].map(cell).join(','),
//     ...rows.map((row) => [row.order_id, Number.isFinite(row.amount) ? row.amount.toFixed(2) : '0.00', row.status, row.created_at, row.paid_at ?? ''].map(cell).join(',')),
//   ];
//   const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
//   const url = URL.createObjectURL(blob);
//   const link = document.createElement('a');
//   link.href = url;
//   link.download = `aurotap-supplier-earnings-recent-${todayIST()}.csv`;
//   link.click();
//   window.setTimeout(() => URL.revokeObjectURL(url), 1000);
//   return true;
// };

// const cleanPhone = (p: string) => p.replace(/[^\d+]/g, '');

// const waLink = (phone: string, text: string) => {
//   const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
//   const num = digits.length === 10 ? `91${digits}` : digits;
//   return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
// };

// const mapsLink = (addr: string) =>
//   `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

// const TIER_RANK: SupplierProfile['tier'][] = ['bronze', 'silver', 'gold', 'platinum'];

// const normalizeOrderStatus = (status: unknown): OrderStatus => {
//   switch (String(status ?? '').toUpperCase()) {
//     case 'ASSIGNED': return 'assigned';
//     case 'IN_PROGRESS': return 'in_progress';
//     case 'COMPLETED':
//     case 'DELIVERED': return 'delivered';
//     case 'CANCELLED': return 'cancelled';
//     case 'PENDING':
//     default: return 'pending';
//   }
// };


// // ─── SVG Icons/ ────────────────────────────────────────────────────────────────

// const Icon = {
//   drop: (s = 18, c = '#0D9B6C') => (
//     <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
//       <path
//         d="M12 2C12 2 5 9.5 5 14.5C5 18.09 8.13 21 12 21C15.87 21 19 18.09 19 14.5C19 9.5 12 2 12 2Z"
//         fill={c}
//         opacity="0.2"
//         stroke={c}
//         strokeWidth="1.5"
//       />
//       <path d="M9 15.5C9.5 17.5 11 18.5 13 18" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
//     </svg>
//   ),
//   wallet: (s = 18) => (
//     <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
//       <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
//       <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
//       <circle cx="17" cy="15" r="1.5" fill="currentColor" />
//     </svg>
//   ),
//   truck: (s = 18) => (
//     <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
//       <path d="M1 3h13v13H1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
//       <path d="M14 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
//       <circle cx="5.5" cy="18.5" r="2" stroke="currentColor" strokeWidth="1.5" />
//       <circle cx="18.5" cy="18.5" r="2" stroke="currentColor" strokeWidth="1.5" />
//     </svg>
//   ),
//   star: (s = 14, filled = true) => (
//     <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
//       <polygon
//         points="7,1 8.8,5.2 13,5.6 10,8.4 10.9,12.5 7,10.3 3.1,12.5 4,8.4 1,5.6 5.2,5.2"
//         fill={filled ? '#F59E0B' : 'rgba(255,255,255,0.12)'}
//       />
//     </svg>
//   ),
//   bell: (s = 18) => (
//     <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
//       <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//       <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
//     </svg>
//   ),
//   chart: (s = 18) => (
//     <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
//       <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
//       <path d="M7 16l4-4 4 4 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   ),
//   check: (s = 14) => (
//     <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
//       <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   ),
//   logout: (s = 16) => (
//     <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
//       <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//       <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//       <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
//     </svg>
//   ),
//   map: (s = 14) => (
//     <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
//       <path d="M7 1C4.8 1 3 2.8 3 5c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z" stroke="currentColor" strokeWidth="1.2" />
//       <circle cx="7" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
//     </svg>
//   ),
//   phone: (s = 14) => (
//     <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
//       <rect x="3.5" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
//       <circle cx="7" cy="10.5" r="0.7" fill="currentColor" />
//     </svg>
//   ),
//   refresh: (s = 16) => (
//     <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
//       <path d="M23 4v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//       <path d="M1 20v-6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//       <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   ),
// };

// const DASHBOARD_CSS = `
// .sdash{
//   --bg:#E4EDF5; --bg2:#EDF4FA; --sh-hi:rgba(255,255,255,.95); --sh-lo:rgba(132,155,182,.50);
//   --ink:#0F2A43; --ink2:#41607D; --ink3:#587490;
//   --brand:#0B8A60; --brand2:#08694B; --aqua:#0277B6; --amber:#9A5A06; --rose:#B91C1C;
//   --r-lg:20px; --r-md:14px; --r-sm:10px;
//   --raise:6px 6px 14px var(--sh-lo),-6px -6px 14px var(--sh-hi);
//   --raise-sm:3px 3px 8px var(--sh-lo),-3px -3px 8px var(--sh-hi);
//   --inset:inset 3px 3px 7px var(--sh-lo),inset -3px -3px 7px var(--sh-hi);
//   min-height:100vh; color:var(--ink); color-scheme:light;
//   background:linear-gradient(180deg,#D9E9F4 0%,var(--bg) 280px,var(--bg) 100%);
//   font-family:var(--font-sans),'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
//   -webkit-tap-highlight-color:transparent; text-rendering:optimizeLegibility;
// }
// .sdash *{box-sizing:border-box;font-family:inherit}
// .sdash h1,.sdash h2{font-family:var(--font-display),var(--font-sans),system-ui,sans-serif}
// .sdash :where(button,input,select){font:inherit;color:inherit}
// .sdash :where(button){cursor:pointer;touch-action:manipulation}
// .sdash :where(button):disabled{cursor:not-allowed}
// .sdash :focus-visible{outline:2px solid var(--aqua);outline-offset:3px}

// /* layout helpers */
// .sd-row{display:flex;align-items:center}.sd-col{display:flex;flex-direction:column}
// .sd-between{justify-content:space-between}.sd-wrap{flex-wrap:wrap}.sd-end{align-items:flex-end}.sd-top{align-items:flex-start}
// .sd-gap6{gap:6px}.sd-gap8{gap:8px}
// .sd-muted-ico{color:var(--ink3);display:inline-flex}

// /* surfaces */
// .sd-card{background:var(--bg);border-radius:var(--r-lg);box-shadow:var(--raise)}
// .sd-well{background:var(--bg);border-radius:var(--r-md);box-shadow:var(--inset);padding:11px 13px;display:flex;flex-direction:column;gap:7px}
// .sd-skel{background:#D3DFEB;animation:sd-pulse 1.3s ease-in-out infinite;flex-shrink:0}
// @keyframes sd-pulse{50%{opacity:.5}}
// @keyframes sd-spin{to{transform:rotate(360deg)}}
// .sd-spin{animation:sd-spin .8s linear infinite}

// /* header */
// .sdash .sd-header{position:sticky;top:48px;z-index:50;background:var(--bg);box-shadow:0 6px 14px -8px var(--sh-lo);padding:0 clamp(14px,4vw,32px)}
// .sd-header-in{max-width:1200px;margin:0 auto;height:58px;display:flex;align-items:center;justify-content:space-between;gap:8px}
// .sd-logo{width:36px;height:36px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#12A875,#08694B);box-shadow:var(--raise-sm)}
// .sd-brand{font-size:15px;font-weight:800;letter-spacing:-.3px;line-height:1;color:var(--ink)}
// .sd-brand-sub{font-size:10px;font-weight:700;color:var(--brand);letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
// .sd-iconbtn{width:38px;height:38px;border-radius:12px;border:0;background:var(--bg);box-shadow:var(--raise-sm);display:flex;align-items:center;justify-content:center;color:var(--ink2);position:relative;transition:box-shadow .15s,color .15s}
// .sd-iconbtn:hover{color:var(--ink)}
// .sd-iconbtn:active{box-shadow:var(--inset)}
// .sd-iconbtn--danger{color:var(--rose)}
// .sd-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#DC2626;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--bg)}
// .sd-pill{display:flex;align-items:center;gap:8px;border-radius:12px;padding:5px;background:var(--bg);box-shadow:var(--inset)}
// .sd-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0}
// .sd-pill-name{display:none;min-width:0;padding-right:6px}
// .sd-pill-name b{display:block;font-size:12px;font-weight:700;line-height:1.1;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
// .sd-pill-name i{display:block;font-style:normal;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
// .sd-sub{display:none}
// .sd-notif{position:absolute;top:46px;right:-86px;width:min(320px,calc(100vw - 24px));background:var(--bg);border-radius:var(--r-lg);box-shadow:0 18px 40px -10px rgba(15,42,67,.35),var(--raise);z-index:100;overflow:hidden}
// .sd-notif-head{padding:13px 16px;font-size:12px;font-weight:800;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 8px -6px var(--sh-lo)}
// .sd-notif-item{padding:12px 16px;border-bottom:1px solid rgba(132,155,182,.22)}
// .sd-notif-item.unread{background:rgba(11,138,96,.07)}
// .sd-notif-item b{font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:3px}
// .sd-notif-item p{margin:0;font-size:11px;color:var(--ink2);line-height:1.5}
// .sd-notif-item time{display:block;font-size:10px;color:var(--ink3);margin-top:4px}

// /* main */
// .sd-main{max-width:1200px;margin:0 auto;padding:clamp(18px,4vw,30px) clamp(14px,4vw,24px) 80px}
// .sd-hero{position:relative;overflow:hidden;border-radius:24px;padding:clamp(16px,3.5vw,28px);margin-bottom:22px;display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;
//   background:radial-gradient(120% 140% at 100% 0%,rgba(2,119,182,.14),transparent 55%),radial-gradient(90% 120% at 0% 100%,rgba(11,138,96,.12),transparent 60%),var(--bg);
//   box-shadow:var(--raise)}
// .sd-hero::after{content:'';position:absolute;right:-50px;bottom:-70px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(2,119,182,.10),transparent 70%);pointer-events:none}
// .sd-eyebrow{font-size:11px;font-weight:800;color:var(--brand);letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
// .sd-h1{margin:0;font-size:clamp(1.4rem,4.5vw,2rem);font-weight:800;letter-spacing:-.6px;line-height:1.1;color:var(--ink)}
// .sd-tier{position:relative;z-index:1;border-radius:var(--r-md);padding:14px 18px;box-shadow:var(--inset);width:100%;min-width:0}
// .sd-track{height:8px;border-radius:99px;background:var(--bg);box-shadow:var(--inset);overflow:hidden;margin:10px 0 7px}
// .sd-track>div{height:100%;border-radius:99px;transition:width .6s ease}

// /* chips & buttons */
// .sd-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap;line-height:1.3}
// .sd-chip--soft{color:var(--ink2);background:rgba(132,155,182,.18)}
// .sd-chip--ok{color:#047857;background:rgba(16,185,129,.16)}
// .sd-chip--warn{color:#9A5A06;background:rgba(245,158,11,.18)}
// .sd-chip--bad{color:#B91C1C;background:rgba(239,68,68,.14)}
// .sd-chip--info{color:#0369A1;background:rgba(14,165,233,.16)}
// .sd-btn{border:0;border-radius:12px;min-height:42px;padding:0 16px;font-weight:800;font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:box-shadow .15s,transform .15s,filter .15s}
// .sd-btn--block{width:100%}
// .sd-btn--primary{color:#fff;background:linear-gradient(145deg,#12A875,#08694B);box-shadow:4px 4px 10px rgba(8,105,75,.35),-3px -3px 8px var(--sh-hi)}
// .sd-btn--primary:hover:not(:disabled){filter:brightness(1.06)}
// .sd-btn--primary:active:not(:disabled){transform:translateY(1px);box-shadow:inset 2px 2px 6px rgba(0,0,0,.25)}
// .sd-btn--info{color:#035E8E;background:var(--bg);box-shadow:var(--raise-sm)}
// .sd-btn--soft{color:var(--ink);background:var(--bg);box-shadow:var(--raise-sm)}
// .sd-btn--danger{color:var(--rose);background:var(--bg);box-shadow:var(--raise-sm)}
// .sd-btn--info:active:not(:disabled),.sd-btn--soft:active:not(:disabled),.sd-btn--danger:active:not(:disabled){box-shadow:var(--inset)}
// .sd-btn:disabled{opacity:.6}
// .sd-btn--sm{min-height:36px;padding:0 12px;font-size:12px}
// .sd-toggle{border:0;border-radius:999px;padding:5px 13px;font-size:11px;font-weight:800;background:var(--bg);box-shadow:var(--raise-sm);color:var(--ink2);transition:box-shadow .15s}
// .sd-toggle[aria-pressed="true"]{box-shadow:var(--inset);color:#047857}

// /* inputs: recessed */
// .sd-input{width:100%;min-width:0;min-height:42px;border:0;border-radius:12px;background:var(--bg);box-shadow:var(--inset);padding:0 13px;color:var(--ink);font-size:13px}
// .sd-input::placeholder{color:var(--ink3)}
// .sd-input:focus{outline:2px solid var(--aqua);outline-offset:2px}
// .sd-input--sm{width:62px;min-height:34px;padding:0 8px;border-radius:10px}

// /* stats */
// .sd-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:24px}
// .sd-stat{padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
// .sd-stat-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
// .sd-stat-label{font-size:12px;font-weight:700;color:var(--ink2);letter-spacing:.02em;min-width:0}
// .sd-stat-icon{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);box-shadow:var(--inset);flex-shrink:0}
// .sd-stat-val{font-size:20px;font-weight:800;letter-spacing:-.5px;line-height:1;color:var(--ink);overflow-wrap:anywhere}
// .sd-stat-sub{font-size:11px;color:var(--ink3);font-weight:500}
// .sd-section-label{font-size:11px;font-weight:800;color:var(--brand2);letter-spacing:.1em;margin-bottom:10px;text-transform:uppercase}
// .sd-mini{padding:12px 14px;border-radius:var(--r-md)}
// .sd-mini-label{font-size:10px;font-weight:800;color:var(--ink3);letter-spacing:.06em;text-transform:uppercase}
// .sd-mini-val{margin-top:6px;font-size:20px;font-weight:800}
// .sd-alert{margin-bottom:12px;padding:12px 14px;border-radius:var(--r-md);box-shadow:var(--inset);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:600}
// .sd-alert--warn{color:#8A4F05;background:rgba(245,158,11,.10)}
// .sd-alert--bad{color:#9B1C1C;background:rgba(239,68,68,.07)}

// /* inventory + dispatch */
// .sd-panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;margin-bottom:28px}
// .sd-panel{padding:18px}
// .sd-panel-label{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
// .sd-big{margin-top:5px;font-size:26px;font-weight:800;letter-spacing:-.5px}
// .sd-help{font-size:11px;color:var(--ink3);line-height:1.5}
// .sd-meter{margin-top:10px;height:8px;width:min(100%,260px);border-radius:99px;box-shadow:var(--inset);overflow:hidden;display:flex;background:var(--bg)}

// /* tabs / filters */
// .sd-seg{display:inline-flex;gap:4px;padding:4px;border-radius:14px;box-shadow:var(--inset);background:var(--bg)}
// .sd-seg button{border:0;border-radius:10px;padding:8px 16px;background:transparent;color:var(--ink2);font-weight:700;font-size:13px;display:flex;align-items:center;gap:7px;transition:box-shadow .15s,color .15s}
// .sd-seg button[aria-selected="true"]{background:var(--bg);box-shadow:var(--raise-sm);color:var(--brand2)}
// .sd-count{font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;min-width:22px;text-align:center;background:rgba(132,155,182,.22);color:var(--ink2)}
// .sd-seg button[aria-selected="true"] .sd-count{background:rgba(11,138,96,.16);color:var(--brand2)}
// .sd-filter{min-height:36px;padding:0 13px;border-radius:999px;border:0;background:var(--bg);box-shadow:var(--raise-sm);color:var(--ink2);font-weight:700;font-size:12px;transition:box-shadow .15s}
// .sd-filter[aria-pressed="true"]{box-shadow:var(--inset);color:var(--brand2)}
// .sd-live{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--ink3);font-weight:600}
// .sd-dot{width:8px;height:8px;border-radius:50%}

// /* orders */
// .sd-orders{display:grid;grid-template-columns:1fr;gap:16px}
// .sd-order{position:relative;overflow:hidden;content-visibility:auto;contain-intrinsic-size:auto 330px;transition:transform .18s}
// .sd-order:hover{transform:translateY(-2px)}
// .sd-order-stripe{position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:var(--st)}
// .sd-order-body{padding:16px 18px 18px 20px;display:flex;flex-direction:column;gap:12px}
// .sd-order-title{font-size:14px;font-weight:800;letter-spacing:-.2px}
// .sd-order-id{font-size:11px;color:var(--ink3);margin-top:2px;font-weight:600}
// .sd-amount{font-size:15px;font-weight:800;color:var(--brand2)}
// .sd-wellrow{font-size:12px;color:var(--ink);font-weight:600;flex-wrap:wrap}
// .sd-addr{font-size:11px;color:var(--ink2)}
// .sd-link{color:var(--aqua);text-decoration:underline;text-underline-offset:3px;font-weight:700}
// .sd-quick{flex:1 1 0;min-width:0;min-height:40px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:12px;font-size:12px;font-weight:700;text-decoration:none;color:var(--ink);background:var(--bg);box-shadow:var(--raise-sm);transition:box-shadow .15s}
// .sd-quick:active{box-shadow:var(--inset)}
// .sd-note{margin:0;font-size:11px;color:var(--ink2);font-style:italic;line-height:1.5;border-left:3px solid rgba(132,155,182,.45);padding-left:9px}
// .sd-empty{text-align:center;padding:56px 24px;border-radius:var(--r-lg);box-shadow:var(--inset)}

// /* earnings */
// .sd-table{border-radius:var(--r-lg);box-shadow:var(--inset);overflow:hidden;padding:6px}
// .sd-earn{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;align-items:center;column-gap:6px;padding:12px 12px;border-radius:12px;transition:background .15s}
// .sd-earn:not(.sd-earn--head):hover{background:rgba(255,255,255,.5)}
// .sd-earn--head div{font-size:10px;font-weight:800;color:var(--ink3);letter-spacing:.08em;text-transform:uppercase}

// /* completion dialog (dark scrim only where focus is needed) */
// .sd-scrim{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,30,50,.62)}
// .sd-modal{width:100%;max-width:460px;max-height:min(720px,calc(100vh - 32px));overflow-y:auto;background:var(--bg);border-radius:24px;box-shadow:0 30px 80px rgba(5,20,35,.5),var(--raise);padding:22px}
// .sd-check{display:flex;align-items:flex-start;gap:10px;margin-top:16px;padding:13px;border-radius:var(--r-md);cursor:pointer;box-shadow:var(--inset);font-size:12px;line-height:1.55;color:var(--ink2)}
// .sd-check input{margin-top:2px;accent-color:var(--brand);width:18px;height:18px;flex-shrink:0}
// .sd-label{display:block;margin:16px 0 7px;font-size:11px;font-weight:800;color:var(--ink2)}

// @media (min-width:560px){
//   .sd-pill{padding:5px 8px 5px 5px}.sd-pill-name{display:block}.sd-sub{display:block}.sd-notif{right:0}
// }
// @media (min-width:720px){
//   .sd-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
//   .sd-stat{padding:18px 20px;gap:12px}.sd-stat-val{font-size:24px}.sd-stat-icon{width:34px;height:34px}
//   .sd-tier{width:auto;min-width:250px}
//   .sd-orders{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
// }
// @media (min-width:1080px){
//   .sd-stats{grid-template-columns:repeat(6,minmax(0,1fr))}.sd-stat{padding:16px}.sd-stat-val{font-size:22px}
// }
// @media (max-width:420px){.sd-earn{padding:11px 6px;font-size:12px}}
// @media (prefers-reduced-motion:reduce){.sdash *{animation:none!important;transition:none!important}}
// @media (hover:none){.sd-order:hover{transform:none}}
// `;

// // ─── Skeleton loader (opacity pulse: cheap on low-end phones) ─────────────────

// function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
//   return <div className="sd-skel" style={{ width: w, height: h, borderRadius: r }} />;
// }

// // ─── Stat card ─────────────────────────────────────────────────────────────────

// function StatCard({
//   icon,
//   label,
//   value,
//   sub,
//   accent,
//   loading,
// }: {
//   icon: React.ReactNode;
//   label: string;
//   value: string;
//   sub?: string;
//   accent: string;
//   loading: boolean;
// }) {
//   return (
//     <div className="sd-card sd-stat" style={{ '--accent': accent } as React.CSSProperties}>
//       <div className="sd-stat-top">
//         <span className="sd-stat-label">{label}</span>
//         <div className="sd-stat-icon">{icon}</div>
//       </div>
//       {loading ? (
//         <>
//           <Skeleton h={28} w="60%" />
//           <Skeleton h={12} w="80%" />
//         </>
//       ) : (
//         <>
//           <div className="sd-stat-val">{value}</div>
//           {sub && <div className="sd-stat-sub">{sub}</div>}
//         </>
//       )}
//     </div>
//   );
// }

// // ─── Water-delivery helpers ───────────────────────────────────────────────────

// type OrderFilter = 'all' | 'today' | 'tomorrow' | 'overdue' | 'cash' | 'accept';

// const FILTER_LABELS: Record<OrderFilter, string> = {
//   all: 'All',
//   today: 'Today',
//   tomorrow: 'Tomorrow',
//   overdue: 'Overdue',
//   cash: 'Cash to collect',
//   accept: 'Needs accept',
// };

// const matchesQuery = (o: Order, q: string) =>
//   !q ||
//   [o.customer_name, o.customer_phone, o.booking_id, o.address_line, o.city, o.service_type].some((v) =>
//     String(v ?? '').toLowerCase().includes(q),
//   );

// function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
//   return (
//     <div className="sd-card sd-mini">
//       <div className="sd-mini-label">{label}</div>
//       <div className="sd-mini-val" style={{ color: tone }}>{value}</div>
//     </div>
//   );
// }

// // ─── Order card ────────────────────────────────────────────────────────────────

// function OrderCard({
//   order,
//   onAccept,
//   onUpdateStatus,
//   onRequestComplete,
//   updating,
// }: {
//   order: Order;
//   onAccept: (id: string) => Promise<void>;
//   onUpdateStatus: (id: string, status: OrderStatus) => Promise<boolean>;
//   onRequestComplete: (order: Order) => void;
//   updating: string | null;
// }) {
//   const sm = STATUS_META[order.status];
//   const isUpdating = updating === order.id;

//   const nextStatus: Record<OrderStatus, OrderStatus | null> = {
//     pending: null,
//     assigned: order.accepted_at ? 'in_progress' : null,
//     in_progress: 'delivered',
//     delivered: null,
//     cancelled: null,
//   };

//   const next = nextStatus[order.status];
//   const isAssignedAndWaiting = order.status === 'assigned' && !order.accepted_at;

//   const today = todayIST();
//   const isActive = ['pending', 'assigned', 'in_progress'].includes(order.status);
//   const canRevealContact = isActive && (order.status === 'in_progress' || (order.status === 'assigned' && Boolean(order.accepted_at)));
//   const hasPhone = canRevealContact && !!order.customer_phone && order.customer_phone !== '—';
//   const fullAddress = canRevealContact ? [order.address_line, order.city].filter(Boolean).join(', ') : '';
//   const isToday = isActive && order.scheduled_date === today;
//   const isOverdue = isActive && !!order.scheduled_date && order.scheduled_date < today;
//   const isPaid = order.payment_status === 'paid';
//   const payMethod = (order.payment_method || 'cash').toUpperCase();

//   const nextLabel: Record<OrderStatus, string> = {
//     pending: '',
//     assigned: 'Start Delivery',
//     in_progress: 'Complete Order',
//     delivered: '',
//     cancelled: '',
//   };

//   return (
//     <article className="sd-card sd-order" style={{ '--st': sm.color } as React.CSSProperties}>
//       <div className="sd-order-stripe" />

//       <div className="sd-order-body">
//         <div className="sd-row sd-between sd-top">
//           <div style={{ minWidth: 0 }}>
//             <div className="sd-order-title">{order.service_type}</div>
//             <div className="sd-order-id">#{order.booking_id.slice(0, 8).toUpperCase()}</div>
//           </div>
//           <div className="sd-col sd-end">
//             <span className="sd-chip" style={{ color: sm.color, background: sm.bg }}>{sm.label}</span>
//             <span className="sd-amount">{INR(order.amount)}</span>
//           </div>
//         </div>

//         <div className="sd-well">
//           <div className="sd-row sd-gap6 sd-wellrow">
//             <span className="sd-muted-ico">{Icon.phone(12)}</span>
//             <span>{order.customer_name} · </span>
//             {hasPhone ? (
//               <a href={`tel:${order.customer_phone.replace(/[^\d+]/g, '')}`} className="sd-link" aria-label={`Call customer ${order.customer_name}`}>
//                 {order.customer_phone}
//               </a>
//             ) : <span>{isActive ? 'Contact shown after acceptance' : 'Contact hidden for privacy'}</span>}
//           </div>
//           <div className="sd-row sd-gap6 sd-top sd-addr">
//             <span className="sd-muted-ico" style={{ marginTop: 1, flexShrink: 0 }}>{Icon.map(11)}</span>
//             <span style={{ flex: 1, minWidth: 0 }}>
//               {canRevealContact ? (fullAddress || 'Address unavailable — refresh order details') : (isActive ? 'Exact address shown after acceptance' : 'Exact address hidden for privacy')}
//             </span>
//             {canRevealContact && fullAddress && (
//               <button type="button" className="sd-btn sd-btn--soft sd-btn--sm" aria-label="Copy delivery address"
//                 onClick={() => {
//                   if (!navigator.clipboard?.writeText) {
//                     toast.error('Clipboard access is unavailable in this browser.');
//                     return;
//                   }
//                   void navigator.clipboard.writeText(fullAddress)
//                     .then(() => toast.success('Delivery address copied'))
//                     .catch(() => toast.error('Could not copy address. Check browser clipboard permissions.'));
//                 }}>
//                 Copy
//               </button>
//             )}
//           </div>
//         </div>

//         <div className="sd-row sd-wrap sd-gap8">
//           <span className="sd-chip sd-chip--soft">📅 {fmtDate(order.scheduled_date)}</span>
//           <span className="sd-chip sd-chip--soft">⏰ {formatScheduledSlot(order.scheduled_slot)}</span>
//           {order.cans_count != null && order.cans_count > 0 && (
//             <span className="sd-chip sd-chip--ok">💧 {order.cans_count} can{order.cans_count > 1 ? 's' : ''}</span>
//           )}
//         </div>

//         {order.status !== 'cancelled' && (
//           <div className="sd-row sd-wrap sd-gap8">
//             {isOverdue && <span className="sd-chip sd-chip--bad">⚠ Overdue</span>}
//             {isToday && <span className="sd-chip sd-chip--warn">● Today</span>}
//             {isPaid ? (
//               <span className="sd-chip sd-chip--ok">✓ Paid · {payMethod}</span>
//             ) : (
//               <span className="sd-chip sd-chip--warn">💵 Collect {INR(order.amount)} · {payMethod}</span>
//             )}
//           </div>
//         )}

//         {canRevealContact && (hasPhone || fullAddress) && (
//           <div className="sd-row sd-gap8">
//             {hasPhone && (
//               <a href={`tel:${cleanPhone(order.customer_phone)}`} className="sd-quick" aria-label={`Call ${order.customer_name}`}>
//                 📞 Call
//               </a>
//             )}
//             {hasPhone && (
//               <a
//                 href={waLink(order.customer_phone, `Hello ${order.customer_name}, this is your AuroTap water supplier about order #${order.booking_id.slice(0, 8).toUpperCase()}${order.scheduled_slot ? ` (${order.scheduled_slot})` : ''}.`)}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="sd-quick"
//                 aria-label={`WhatsApp ${order.customer_name}`}
//               >
//                 💬 WhatsApp
//               </a>
//             )}
//             {fullAddress && (
//               <a href={mapsLink(fullAddress)} target="_blank" rel="noopener noreferrer" className="sd-quick" aria-label="Navigate to delivery address">
//                 🧭 Navigate
//               </a>
//             )}
//           </div>
//         )}

//         {order.notes && <p className="sd-note">{order.notes}</p>}

//         {isAssignedAndWaiting && (
//           <button type="button" disabled={isUpdating} onClick={() => onAccept(order.id)} className="sd-btn sd-btn--info sd-btn--block">
//             {isUpdating ? 'Confirming…' : 'Accept Order'}
//           </button>
//         )}

//         {next && (
//           <button
//             type="button"
//             disabled={isUpdating}
//             onClick={() => next === 'delivered' ? onRequestComplete(order) : onUpdateStatus(order.id, next)}
//             className="sd-btn sd-btn--primary sd-btn--block"
//           >
//             {isUpdating ? (
//               <svg className="sd-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
//                 <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" />
//                 <path d="M7 1.5A5.5 5.5 0 0 0 1.5 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
//               </svg>
//             ) : (
//               Icon.check(14)
//             )}
//             {isUpdating ? 'Updating…' : nextLabel[order.status]}
//           </button>
//         )}
//       </div>
//     </article>
//   );
// }

// // ─── Main page ─────────────────────────────────────────────────────────────────

// export default function SupplierDashboardPage() {
//   const router = useRouter();
//   const supabase = createClient();

//   const [profile, setProfile] = useState<SupplierProfile | null>(null);
//   const [orders, setOrders] = useState<Order[]>([]);
//   const [earnings, setEarnings] = useState<EarningRow[]>([]);
//   const [notifications, setNotifications] = useState<Notification[]>([]);
//   const [stats, setStats] = useState<DashboardStats | null>(null);
//   const [stock, setStock] = useState<SupplierStockState | null>(null);
//   const [stockDelta, setStockDelta] = useState('');
//   const [lowStockInput, setLowStockInput] = useState('');
//   const [bufferInput, setBufferInput] = useState('');
//   const [stockBusy, setStockBusy] = useState(false);
//   const [locationBusy, setLocationBusy] = useState(false);
//   const [dispatchOnline, setDispatchOnline] = useState(false);
//   const [dispatchSettingsBusy, setDispatchSettingsBusy] = useState(false);

//   const [tab, setTab] = useState<'active' | 'history'>('active');
//   const [showNotifs, setShowNotifs] = useState(false);
//   const [mounted, setMounted] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [loadingOrders, setLoadingOrders] = useState(true);
//   const [ordersStale, setOrdersStale] = useState(false);
//   const [networkOnline, setNetworkOnline] = useState(true);
//   const [earningsSummary, setEarningsSummary] = useState<{ period: string; order_count: number; gross_amount: number; pending_payout: number } | null>(null);
//   const [ratingLoadState, setRatingLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
//   const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
//   const [signingOut, setSigningOut] = useState(false);
//   const [completionOrder, setCompletionOrder] = useState<Order | null>(null);
//   const [paymentReference, setPaymentReference] = useState('');
//   const [paymentConfirmed, setPaymentConfirmed] = useState(false);
//   const [paymentCollector, setPaymentCollector] = useState<'supplier' | 'aurotap'>('supplier');
//   const [query, setQuery] = useState('');
//   const [filter, setFilter] = useState<OrderFilter>('all');
//   // Tracks which "assigned, not yet accepted" orders we've already seen,
//   // so a genuinely new assignment can trigger an instant alert.
//   const knownWaitingRef = useRef<Set<string> | null>(null);
//   // Silent refreshes: skeletons only show on the very first load, never on focus/realtime updates.
//   const profileLoadedRef = useRef(false);
//   const ordersLoadedRef = useRef(false);
//   const lastLoadRef = useRef(0);


//   // ── Auth guard + safe session recovery ───────────────────────────────────────
//   useEffect(() => {
//     setMounted(true);
//     let active = true;
//     let initialized = false;
//     let refreshInFlight = false;
//     const redirectToLogin = () => { if (active) router.replace('/auth/login?redirect=/supplier/dashboard'); };

//     const initialize = async () => {
//       try {
//         let result = await supabase.auth.getSession();
//         if (result.error) {
//           await new Promise((resolve) => setTimeout(resolve, 900));
//           result = await supabase.auth.getSession();
//         }
//         if (!active) return;
//         if (result.error) {
//           console.error('[supplier] session check failed:', result.error.message);
//           toast.error('Could not verify your session. Check your connection and retry.');
//           return;
//         }
//         if (!result.data.session?.user) { redirectToLogin(); return; }
//         await loadAll(result.data.session.user.id);
//       } catch (error) {
//         console.error('[supplier] session initialization failed:', error instanceof Error ? error.message : error);
//         if (active) toast.error('Could not verify your session. Please retry without closing the page.');
//       } finally { initialized = true; }
//     };
//     void initialize();

//     const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
//       if (active && initialized && event === 'SIGNED_OUT' && !session) redirectToLogin();
//     });

//     const refreshOnFocus = () => {
//       if (!active || !initialized || document.visibilityState !== 'visible' || !navigator.onLine || refreshInFlight) return;
//       // Coming back to the tab refreshes at most every 20s (saves requests on the free plan).
//       if (Date.now() - lastLoadRef.current < 20_000) return;
//       refreshInFlight = true;
//       void (async () => {
//         try {
//           const result = await supabase.auth.getSession();
//           if (result.error) { console.warn('[supplier] focus session check failed:', result.error.message); return; }
//           if (!result.data.session?.user) {
//             // A missing session on tab focus can be a brief storage/refresh race; verify once more.
//             await new Promise((resolve) => setTimeout(resolve, 900));
//             const retry = await supabase.auth.getSession();
//             if (retry.error) {
//               console.warn('[supplier] retry session check failed:', retry.error.message);
//               return;
//             }
//             if (!retry.data.session?.user) { redirectToLogin(); return; }
//             await loadAll(retry.data.session.user.id);
//             return;
//           }
//           await loadAll(result.data.session.user.id);
//         } catch (error) {
//           console.error('[supplier] focus refresh failed:', error instanceof Error ? error.message : error);
//         } finally { refreshInFlight = false; }
//       })();
//     };
//     const online = () => { setNetworkOnline(true); refreshOnFocus(); };
//     const offline = () => setNetworkOnline(false);
//     setNetworkOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
//     window.addEventListener('focus', refreshOnFocus);
//     document.addEventListener('visibilitychange', refreshOnFocus);
//     window.addEventListener('online', online);
//     window.addEventListener('offline', offline);
//     return () => {
//       active = false;
//       subscription.unsubscribe();
//       window.removeEventListener('focus', refreshOnFocus);
//       document.removeEventListener('visibilitychange', refreshOnFocus);
//       window.removeEventListener('online', online);
//       window.removeEventListener('offline', offline);
//     };
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // ── Load all data ───────────────────────────────────────────────────────────
//   const loadAll = useCallback(async (userId: string) => {
//     lastLoadRef.current = Date.now();
//     if (!profileLoadedRef.current) setLoading(true);
//     try {
//       await Promise.all([
//         fetchProfile(userId),
//         fetchNotifications(userId),
//         fetchStock(),
//         fetchDispatchSettings(),
//       ]);
//     } finally {
//       profileLoadedRef.current = true;
//       setLoading(false);
//     }
//   }, []); // eslint-disable-line react-hooks/exhaustive-deps

//   const fetchProfile = async (userId: string) => {
//     // The production schema stores supplier identity in public.profiles.
//     // Do not query the legacy supplier_profiles table (it is not deployed).
//     const { data, error } = await supabase
//       .from('profiles')
//       .select('id, full_name, phone, city, is_active, status, role')
//       .eq('id', userId)
//       .eq('role', 'supplier')
//       .maybeSingle();

//     if (error || !data) {
//       console.error('[supplier] profile load failed:', error?.message ?? 'Supplier profile not found');
//       toast.error('Could not load your supplier account. Please contact support if your account was recently approved.');
//       return;
//     }

//     const normalized: SupplierProfile = {
//       id: data.id,
//       user_id: data.id,
//       full_name: data.full_name ?? 'Supplier',
//       phone: data.phone ?? '',
//       city: data.city ?? '',
//       tier: 'bronze',
//       is_active: data.is_active === true && data.status === 'active',
//       is_verified: data.status === 'active',
//       total_deliveries: 0,
//       total_earnings: 0,
//       rating: 0,
//       rating_count: 0,
//       created_at: new Date().toISOString(),
//     };

//     if (!profileLoadedRef.current) setRatingLoadState('loading');
//     setProfile((current) => current?.id === normalized.id
//       ? { ...normalized, rating: current.rating, rating_count: current.rating_count }
//       : normalized);
//     await Promise.all([
//       fetchOrders(),
//       fetchEarnings(normalized.id),
//       (async () => {
//         try {
//           const rating = await supplierRatingGet();
//           setProfile((current) => current?.id === normalized.id ? { ...current, rating: rating.average_rating, rating_count: rating.review_count } : current);
//           setRatingLoadState('loaded');
//         } catch (ratingError) {
//           setRatingLoadState('error');
//           console.warn('[supplier] rating unavailable:', ratingError instanceof Error ? ratingError.message : ratingError);
//         }
//       })(),
//     ]);
//     buildStats(normalized);
//   };

//   const fetchOrders = async () => {
//     if (!ordersLoadedRef.current) setLoadingOrders(true);

//     try {
//       // Use the role-protected API instead of querying legacy "customers"
//       // relations and columns that are not part of the current profiles/orders schema.
//       // One quiet retry: a single gateway hiccup (502/503) should not blank the screen.
//       let rows: Awaited<ReturnType<typeof supplierOrdersList>>;
//       try {
//         rows = await supplierOrdersList();
//       } catch {
//         await new Promise((resolve) => setTimeout(resolve, 1200));
//         rows = await supplierOrdersList();
//       }
//       setOrdersStale(false);
//       const flat: Order[] = rows.map((row) => {
//         const noteText = String(row.note ?? row.notes ?? '');
//         const slotMatch = noteText.match(/(?:^|\|\s*)Slot:\s*([^|]+)/i);
//         const scheduledValue = row.scheduled_date ?? row.scheduled_at ?? row.scheduled_time ?? '';
//         const scheduledDate = toISTDateKey(scheduledValue);

//         return {
//           id: String(row.id ?? ''),
//           booking_id: String(row.order_number ?? row.booking_id ?? row.id ?? ''),
//           service_type: String(row.service_type_label ?? row.service_type ?? row.service_type_key ?? row.service_type_id ?? 'Service'),
//           status: normalizeOrderStatus(row.status),
//           amount: Number(row.final_amount ?? row.total_amount ?? row.amount ?? 0),
//           cans_count: row.can_count == null && row.can_quantity == null && row.cans_count == null
//             ? null
//             : Number(row.can_count ?? row.can_quantity ?? row.cans_count),
//           scheduled_date: scheduledDate,
//           scheduled_slot: String(row.time_slot ?? row.scheduled_slot ?? slotMatch?.[1]?.trim() ?? ''),
//           notes: row.note ?? row.notes ?? null,
//           created_at: String(row.created_at ?? ''),
//           accepted_at: row.accepted_at ?? null,
//           payment_method: row.payment_method ?? null,
//           payment_status: row.payment_status ?? null,
//           address_line: String(row.address_text ?? ''),
//           city: '',
//           customer_name: String(row.customer_name ?? '—'),
//           customer_phone: String(row.customer_phone ?? '—'),
//         };
//       });

//       setOrders(flat);

//       const waiting = flat.filter((o) => o.status === 'assigned' && !o.accepted_at).map((o) => o.id);
//       if (knownWaitingRef.current === null) {
//         knownWaitingRef.current = new Set(waiting);
//       } else {
//         const known = knownWaitingRef.current;
//         const fresh = waiting.filter((id) => !known.has(id));
//         if (fresh.length > 0) {
//           toast.success(
//             fresh.length === 1 ? 'New order assigned to you' : `${fresh.length} new orders assigned to you`,
//             { description: 'Open Active Orders to accept.' },
//           );
//           try { navigator.vibrate?.(200); } catch { /* not supported */ }
//         }
//         knownWaitingRef.current = new Set(waiting);
//       }
//     } catch (error) {
//       console.error('[supplier] orders load failed:', error);
//       // Keep whatever we already showed; just flag it as possibly out of date.
//       setOrdersStale(true);
//       const raw = error instanceof Error ? error.message : '';
//       const friendly = /50[0-4]|bad gateway|unavailable|timeout|fetch/i.test(raw) || !raw
//         ? 'Server is busy. Showing your last loaded orders, retrying automatically.'
//         : raw;
//       toast.error(friendly, { id: 'orders-load-error' });
//     } finally {
//       ordersLoadedRef.current = true;
//       setLoadingOrders(false);
//     }
//   };

//   const fetchEarnings = async (supplierId: string) => {
//     // Earnings are derived from the canonical orders table in production.
//     // Do not query the legacy supplier_earnings table (it is not deployed).
//     const { data, error } = await supabase
//       .from('orders')
//       .select('*')
//       .eq('supplier_id', supplierId)
//       .order('created_at', { ascending: false })
//       .limit(200);

//     if (error) {
//       console.error('[supplier] earnings load failed:', error.message);
//       setEarnings([]);
//       return;
//     }

//     try {
//       const summary = await supplierEarningsSummary('month');
//       setEarningsSummary(summary);
//     } catch (summaryError) {
//       setEarningsSummary(null);
//       console.warn('[supplier] earnings summary unavailable:', summaryError instanceof Error ? summaryError.message : summaryError);
//     }
//     // Filter status on the client: an enum filter with an unknown label makes PostgREST answer 400.
//     const doneRows = (data ?? []).filter((row) =>
//       ['completed', 'delivered'].includes(String(row.status ?? '').toLowerCase()),
//     );
//     setEarnings(doneRows.slice(0, 50).map((row) => {
//       const amount = Number(row.supplier_payout ?? 0);
//       const payoutStatus = String(row.payout_status ?? 'pending').toLowerCase();
//       const paidAt = typeof row.payout_paid_at === 'string' ? row.payout_paid_at : null;
//       // Supplier payout is posted by the database the moment an order is completed (sql/023), so a
//       // positive amount IS the posted figure. Only a completed order with no payout yet needs review.
//       const needsReview = !Number.isFinite(amount) || amount <= 0;
//       const isSettled = payoutStatus === 'paid' && !needsReview;
//       return {
//         id: String(row.id),
//         order_id: String(row.id),
//         amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
//         status: needsReview ? 'review' as const : isSettled ? 'paid' as const : 'pending' as const,
//         paid_at: isSettled ? paidAt : null,
//         created_at: String(row.completed_at ?? row.created_at ?? ''),
//       };
//     }));
//   };

//   const fetchDispatchSettings = async () => {
//     try {
//       const data = await supplierSettingsGet();
//       setDispatchOnline(Boolean(data?.is_online));
//     } catch (error) {
//       console.error('[supplier] dispatch settings load failed:', error);
//     }
//   };

//   const toggleDispatchAvailability = async () => {
//     if (dispatchSettingsBusy) return;
//     setDispatchSettingsBusy(true);
//     try {
//       const data = await supplierSettingsUpdate({ is_online: !dispatchOnline });
//       setDispatchOnline(Boolean(data.is_online));
//       toast.success(data.is_online ? 'You are now available for nearby orders.' : 'You are offline for new orders.');
//     } catch (error) {
//       console.error('[supplier] dispatch availability update failed:', error);
//       toast.error('Could not update order availability.');
//     } finally {
//       setDispatchSettingsBusy(false);
//     }
//   };

//   const fetchStock = async () => {
//     try {
//       const data = await supplierStockGet();
//       setStock(data);
//       setLowStockInput(data ? String(data.low_stock_alert) : '');
//       setBufferInput(data ? String(data.reservation_buffer_cans) : '');
//     } catch (error) {
//       console.error('[supplier] stock load failed:', error);
//       setStock(null);
//     }
//   };

//   const adjustStock = async (delta: number) => {
//     if (!Number.isInteger(delta) || delta === 0 || stockBusy) return;
//     setStockBusy(true);
//     try {
//       const data = await supplierStockUpdate({ stock_delta: delta });
//       setStock(data);
//       setStockDelta('');
//       toast.success(delta < 0 ? 'Offline sale recorded.' : 'Stock added.');
//     } catch (error) {
//       console.error('[supplier] stock update failed:', error);
//       toast.error('Stock could not be updated. Reserved stock is protected.');
//     } finally {
//       setStockBusy(false);
//     }
//   };

//   const updateStockControls = async (patch: {
//     low_stock_alert?: number;
//     reservation_buffer_cans?: number;
//   }) => {
//     if (!stock || stockBusy) return;
//     setStockBusy(true);
//     try {
//       const data = await supplierStockUpdate({
//         cans_available: stock.cans_available,
//         ...patch,
//       });
//       setStock(data);
//       toast.success('Inventory controls updated.');
//     } catch (error) {
//       console.error('[supplier] stock controls update failed:', error);
//       toast.error('Inventory controls could not be saved.');
//     } finally {
//       setStockBusy(false);
//     }
//   };

//   const syncDispatchLocation = async () => {
//     if (locationBusy || typeof navigator === 'undefined' || !navigator.geolocation) {
//       toast.error('Location is not available in this browser.');
//       return;
//     }

//     setLocationBusy(true);
//     navigator.geolocation.getCurrentPosition(
//       async (position) => {
//         try {
//           const token = await supabase.auth.getSession();
//           if (!token.data.session) {
//             toast.error('Your session has expired.');
//             return;
//           }

//           const response = await fetch('/api/supplier/settings', {
//             method: 'PUT',
//             headers: {
//               'Content-Type': 'application/json',
//               Authorization: `Bearer ${token.data.session.access_token}`,
//             },
//             body: JSON.stringify({
//               base_lat: position.coords.latitude,
//               base_lng: position.coords.longitude,
//             }),
//           });

//           if (!response.ok) {
//             throw new Error('Location update failed');
//           }

//           toast.success('Dispatch location updated.');
//         } catch (error) {
//           console.error('[supplier] dispatch location update failed:', error);
//           toast.error('Could not update dispatch location.');
//         } finally {
//           setLocationBusy(false);
//         }
//       },
//       (error) => {
//         console.error('[supplier] geolocation failed:', error);
//         toast.error('Please allow location access to improve nearby order matching.');
//         setLocationBusy(false);
//       },
//       { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
//     );
//   };

//   const fetchNotifications = async (userId: string) => {
//     const { data, error } = await supabase
//       .from('notifications')
//       .select('*')
//       .eq('user_id', userId)
//       .order('created_at', { ascending: false })
//       .limit(20);

//     if (error) {
//       console.error('[supplier] notifications load failed:', error);
//       setNotifications([]);
//       return;
//     }

//     setNotifications((data as Notification[]) ?? []);
//   };

//   const buildStats = (p: SupplierProfile) => {
//     // Will be recalculated from real orders after fetchOrders resolves
//     // Starting with profile-stored aggregates
//     setStats({
//       todayOrders: 0,
//       pendingOrders: 0,
//       weekEarnings: 0,
//       monthEarnings: 0,
//       completionRate: 0,
//       avgRating: p.rating,
//     });
//   };

//   // Recalculate stats from live order data
//   useEffect(() => {
//     if (!profile) return;
//     const today = todayIST();
//     const weekAgo = Date.now() - 7 * 864e5;
//     const monthAgo = Date.now() - 30 * 864e5;

//     const todayOrders = orders.filter((o) => o.scheduled_date === today).length;
//     const pendingOrders = orders.filter((o) =>
//       ['pending', 'assigned', 'in_progress'].includes(o.status)
//     ).length;

//     const weekEarnings = earnings
//       .filter((e) => e.status !== 'review' && toMs(e.created_at) >= weekAgo)
//       .reduce((sum, e) => sum + e.amount, 0);

//     const monthEarnings = earnings
//       .filter((e) => e.status !== 'review' && toMs(e.created_at) >= monthAgo)
//       .reduce((sum, e) => sum + e.amount, 0);

//     const delivered = orders.filter((o) => o.status === 'delivered').length;
//     const completionRate =
//       orders.length > 0 ? Math.round((delivered / orders.length) * 100) : 0;

//     setStats({
//       todayOrders,
//       pendingOrders,
//       weekEarnings,
//       monthEarnings,
//       completionRate,
//       avgRating: profile.rating,
//     });
//   }, [orders, earnings, profile]);

//   // ── Realtime (debounced, polls only when websocket is down) ─────────────────
//   const { status: realtimeStatus } = useSupplierRealtime({
//     supplierId: profile?.id,
//     onOrdersChange: async () => {
//       if (!profile?.id) return;
//       await Promise.all([fetchOrders(), fetchEarnings(profile.id)]);
//     },
//     onNotification: (row) => {
//       const notif = row as unknown as Notification;
//       setNotifications((prev) => [notif, ...prev.slice(0, 19)]);
//       toast.info(notif.title, { description: notif.body });
//     },
//   });


//   // ── Protected supplier workflow actions ─────────────────────────────────────
//   const handleAcceptOrder = useCallback(async (orderId: string) => {
//     setUpdatingOrder(orderId);
//     try {
//       await supplierOrderAccept(orderId);
//       setOrders((prev) =>
//         prev.map((o) =>
//           o.id === orderId
//             ? { ...o, accepted_at: new Date().toISOString() }
//             : o
//         )
//       );
//       toast.success('Order accepted. You can now start delivery.');
//     } catch (e) {
//       toast.error(e instanceof Error ? e.message : 'Unable to accept this order.');
//       if (profile?.id) await fetchOrders();
//     } finally {
//       setUpdatingOrder(null);
//     }
//   }, [profile?.id]);

//   const handleUpdateStatus = useCallback(
//     async (
//       orderId: string,
//       newStatus: OrderStatus,
//       payment?: {
//         payment_confirmed?: boolean;
//         payment_reference?: string;
//         payment_collector?: 'supplier' | 'aurotap';
//       },
//     ): Promise<boolean> => {
//       setUpdatingOrder(orderId);

//       try {
//         const apiStatus =
//           newStatus === 'delivered' ? 'COMPLETED' : 'IN_PROGRESS';

//         await supplierOrderUpdateStatus(orderId, apiStatus, payment);

//         const nextStatus =
//           newStatus === 'delivered' ? 'delivered' : newStatus;

//         setOrders((prev) =>
//           prev.map((o) =>
//             o.id === orderId
//               ? {
//                   ...o,
//                   status: nextStatus,
//                   ...(nextStatus === 'delivered'
//                     ? { payment_status: 'paid' }
//                     : {}),
//                 }
//               : o,
//           ),
//         );

//         toast.success(
//           nextStatus === 'delivered'
//             ? 'Order completed and payment recorded.'
//             : `Order moved to ${STATUS_META[nextStatus].label}.`,
//         );

//         if (profile?.id) {
//           // Completion changes supplier_payout/payout_status atomically in the database.
//           // Refresh earnings immediately as well as orders; realtime delivery is not guaranteed.
//           await Promise.all([
//             fetchOrders(),
//             ...(nextStatus === 'delivered' ? [fetchEarnings(profile.id)] : []),
//           ]);
//         }

//         return true;
//       } catch (error) {
//         console.error('[supplier] update status failed:', error);

//         toast.error(
//           error instanceof Error
//             ? error.message
//             : 'Failed to update order status.',
//         );

//         return false;
//       } finally {
//         setUpdatingOrder(null);
//       }
//     },
//     [profile?.id],
//   );

//   // ── Sign out ────────────────────────────────────────────────────────────────
//   const handleSignOut = async () => {
//     setSigningOut(true);
//     try {
//       const { error } = await supabase.auth.signOut();

//       if (error) {
//         throw error;
//       }

//       toast.success('Signed out successfully.');
//       router.push('/auth/login');
//     } catch (error) {
//       console.error('[supplier] sign out failed:', error);
//       toast.error(
//         error instanceof Error ? error.message : 'Unable to sign out.',
//       );
//     } finally {
//       setSigningOut(false);
//     }
//   };

//   // ── Mark notifications read ─────────────────────────────────────────────────
//   const markNotifsRead = async () => {
//     const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
//     if (!unreadIds.length) return;

//     const { error } = await supabase
//       .from('notifications')
//       .update({ is_read: true })
//       .in('id', unreadIds);

//     if (error) {
//       console.error('[supplier] notification read update failed:', error);
//       toast.error('Unable to mark notifications as read.');
//       return;
//     }

//     setNotifications((prev) =>
//       prev.map((n) => ({ ...n, is_read: true })),
//     );
//   };

//   // ── Derived ─────────────────────────────────────────────────────────────────
//   const activeOrders = useMemo(
//     () => orders.filter((o) => ['pending', 'assigned', 'in_progress'].includes(o.status)),
//     [orders]
//   );
//   const historyOrders = useMemo(
//     () => orders.filter((o) => ['delivered', 'cancelled'].includes(o.status)),
//     [orders]
//   );
//   const q = query.trim().toLowerCase();
//   const todayStr = todayIST();
//   const tomorrowStr = tomorrowIST();

//   const filteredActive = useMemo(
//     () =>
//       activeOrders
//         .filter((o) => {
//           if (!matchesQuery(o, q)) return false;
//           if (filter === 'today') return o.scheduled_date === todayStr;
//           if (filter === 'tomorrow') return o.scheduled_date === tomorrowStr;
//           if (filter === 'overdue') return !!o.scheduled_date && o.scheduled_date < todayStr;
//           if (filter === 'cash') return o.payment_status !== 'paid';
//           if (filter === 'accept') return o.status === 'assigned' && !o.accepted_at;
//           return true;
//         })
//         .sort((a, b) =>
//           (a.scheduled_date || '9999').localeCompare(b.scheduled_date || '9999') ||
//           a.scheduled_slot.localeCompare(b.scheduled_slot) ||
//           a.created_at.localeCompare(b.created_at),
//         ),
//     [activeOrders, q, filter, todayStr, tomorrowStr],
//   );
//   const filteredHistory = useMemo(
//     () => historyOrders.filter((o) => matchesQuery(o, q)),
//     [historyOrders, q],
//   );
//   const displayOrders = tab === 'active' ? filteredActive : filteredHistory;
//   const hasFilter = q !== '' || (tab === 'active' && filter !== 'all');

//   const route = useMemo(() => {
//     const todays = activeOrders.filter((o) => o.scheduled_date === todayStr);
//     const slots = new Map<string, number>();
//     todays.forEach((o) => {
//       const key = o.scheduled_slot || 'Anytime';
//       slots.set(key, (slots.get(key) ?? 0) + 1);
//     });
//     return {
//       todays: todays.length,
//       overdue: activeOrders.filter((o) => o.scheduled_date && o.scheduled_date < todayStr).length,
//       cans: todays.reduce((sum, o) => sum + (o.cans_count ?? 0), 0),
//       cash: todays.reduce((sum, o) => sum + (o.payment_status === 'paid' ? 0 : o.amount), 0),
//       awaiting: activeOrders.filter((o) => o.status === 'assigned' && !o.accepted_at).length,
//       slots: Array.from(slots.entries()),
//     };
//   }, [activeOrders, todayStr]);

//   const freeCans = stock ? Math.max(0, stock.cans_available - stock.reserved_cans) : 0;
//   const lowStock = !!stock && freeCans <= stock.low_stock_alert;
//   const unreadCount = notifications.filter((n) => !n.is_read).length;
//   const deliveredCount = useMemo(() => orders.filter((o) => o.status === 'delivered').length, [orders]);
//   const deliveries = Math.max(profile?.total_deliveries ?? 0, deliveredCount);
//   const earnedTotal = Math.max(profile?.total_earnings ?? 0, earnings.filter((e) => e.status !== 'review').reduce((sum, e) => sum + e.amount, 0));
//   const derivedTier: SupplierProfile['tier'] =
//     deliveries >= 400 ? 'platinum' : deliveries >= 150 ? 'gold' : deliveries >= 50 ? 'silver' : 'bronze';
//   const effectiveTier: SupplierProfile['tier'] =
//     TIER_RANK.indexOf(derivedTier) > TIER_RANK.indexOf(profile?.tier ?? 'bronze')
//       ? derivedTier
//       : profile?.tier ?? 'bronze';
//   const tier = profile ? TIER_META[effectiveTier] : null;
//   const tierProgress =
//     profile && tier
//       ? Math.min(100, Math.round((deliveries / tier.target) * 100))
//       : 0;

//   // Live count in the browser tab title, e.g. "(3) Supplier Dashboard"
//   useEffect(() => {
//     const n = activeOrders.length;
//     document.title = n > 0 ? `(${n}) Supplier Dashboard | AuroTap` : 'Supplier Dashboard | AuroTap';
//   }, [activeOrders.length]);

//   const reloadAll = async () => {
//     const { data: { session } } = await supabase.auth.getSession();
//     if (session?.user) await loadAll(session.user.id);
//   };


//   if (!mounted) return null;

//   // ─────────────────────────────────────────────────────────────────────────────

//   return (
//     <>
//       <style>{DASHBOARD_CSS}</style>

//       <div className="sdash">
//         {!networkOnline && (
//           <div role="status" aria-live="polite" className="sd-alert sd-alert--bad" style={{ position: 'sticky', top: 0, zIndex: 80, margin: 0, borderRadius: 0, justifyContent: 'center', textAlign: 'center', background: '#FBE4E4', fontWeight: 800 }}>
//             You are offline. Dashboard data may be out of date; it will refresh when connection returns.
//           </div>
//         )}
//         {/* ── HEADER ─────────────────────────────────────────────────────── */}
//         <header className="sd-header">
//           <div className="sd-header-in">
//             <div className="sd-row" style={{ gap: 10, minWidth: 0 }}>
//               <div className="sd-logo">{Icon.drop(19, '#fff')}</div>
//               <div>
//                 <div className="sd-brand">AuroTap</div>
//                 <div className="sd-brand-sub sd-sub">Supplier Portal</div>
//               </div>
//             </div>

//             <div className="sd-row" style={{ gap: 10, flexShrink: 0 }}>
//               <button
//                 type="button"
//                 title="Refresh data"
//                 aria-label="Refresh data"
//                 className="sd-iconbtn"
//                 onClick={async () => {
//                   const { data: { session } } = await supabase.auth.getSession();
//                   if (session?.user) await loadAll(session.user.id);
//                   toast.success('Dashboard refreshed.');
//                 }}
//               >
//                 {Icon.refresh(15)}
//               </button>

//               <div style={{ position: 'relative' }}>
//                 <button
//                   type="button"
//                   aria-label="Notifications"
//                   aria-expanded={showNotifs}
//                   className="sd-iconbtn"
//                   onClick={() => { setShowNotifs((v) => !v); if (!showNotifs) markNotifsRead(); }}
//                 >
//                   {Icon.bell(16)}
//                   {unreadCount > 0 && <span className="sd-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
//                 </button>

//                 {showNotifs && (
//                   <div className="sd-notif">
//                     <div className="sd-notif-head">
//                       Notifications
//                       <span style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 600 }}>{notifications.length} total</span>
//                     </div>
//                     <div style={{ maxHeight: 320, overflowY: 'auto' }}>
//                       {notifications.length === 0 ? (
//                         <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>No notifications yet</div>
//                       ) : notifications.map((n) => (
//                         <div key={n.id} className={`sd-notif-item${n.is_read ? '' : ' unread'}`}>
//                           <b>
//                             {!n.is_read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block', flexShrink: 0 }} />}
//                             {n.title}
//                           </b>
//                           <p>{n.body}</p>
//                           <time>{fmtTime(n.created_at)}</time>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>

//               {loading ? (
//                 <Skeleton w={110} h={38} r={12} />
//               ) : (
//                 <div className="sd-pill">
//                   <div className="sd-avatar" style={{ background: `linear-gradient(145deg,${tier?.color ?? '#0B8A60'},${tier?.color ?? '#08694B'}cc)` }}>
//                     {profile?.full_name?.[0]?.toUpperCase() ?? 'S'}
//                   </div>
//                   <div className="sd-pill-name">
//                     <b>{profile?.full_name?.split(' ')[0] ?? 'Supplier'}</b>
//                     <i style={{ color: tier?.color ?? 'var(--brand)' }}>{tier?.label ?? '—'} Tier</i>
//                   </div>
//                 </div>
//               )}

//               <button
//                 type="button"
//                 disabled={signingOut}
//                 onClick={handleSignOut}
//                 title="Sign out"
//                 aria-label="Sign out"
//                 className="sd-iconbtn sd-iconbtn--danger"
//               >
//                 {Icon.logout(15)}
//               </button>
//             </div>
//           </div>
//         </header>

//         {/* ── MAIN ───────────────────────────────────────────────────────── */}
//         <main className="sd-main">
//           {!loading && !profile && (
//             <div role="alert" className="sd-alert sd-alert--bad" style={{ padding: '20px', display: 'block' }}>
//               <div style={{ fontSize: 15, fontWeight: 800 }}>Supplier account not found</div>
//               <p style={{ margin: '6px 0 14px', fontSize: 12, lineHeight: 1.6, fontWeight: 500, color: 'var(--ink2)' }}>
//                 We could not load your supplier profile. If your account was recently approved, wait a minute and retry, or contact support.
//               </p>
//               <button type="button" onClick={() => void reloadAll()} className="sd-btn sd-btn--primary">Retry</button>
//             </div>
//           )}

//           {ordersStale && !loading && (
//             <div role="status" className="sd-alert sd-alert--warn">
//               <span>Live data is delayed. Showing your last loaded orders.</span>
//               <button type="button" onClick={() => void fetchOrders()} className="sd-btn sd-btn--soft sd-btn--sm">Retry now</button>
//             </div>
//           )}

//           {/* Hero */}
//           <div className="sd-hero">
//             <div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
//               <div className="sd-eyebrow">
//                 {loading ? <Skeleton w={120} h={12} /> : `Welcome back${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
//               </div>
//               <h1 className="sd-h1">{loading ? <Skeleton w={260} h={32} /> : 'Supplier Dashboard'}</h1>
//               {!loading && (
//                 <p style={{ margin: '8px 0 0', maxWidth: 680, color: 'var(--ink2)', fontSize: 13, lineHeight: 1.65 }}>
//                   Orders लेने के लिए Online रहें। नया order आए तो details देखें, समय पर accept करें और delivery पूरी होने पर ही status update करें।
//                   <span style={{ display: 'block', marginTop: 3, fontSize: 12 }}>Stay online to receive orders. Check the details, accept on time, and update the status only after delivery.</span>
//                 </p>
//               )}
//               {!loading && profile && (
//                 <div className="sd-row sd-wrap sd-gap8" style={{ marginTop: 12 }}>
//                   <span className={`sd-chip ${profile.is_active ? 'sd-chip--ok' : 'sd-chip--bad'}`}>
//                     {profile.is_active ? '● Active' : '● Inactive'}
//                   </span>
//                   {profile.is_verified && <span className="sd-chip sd-chip--info">✓ Verified</span>}
//                   <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>{profile.city}</span>
//                   <button
//                     type="button"
//                     disabled={dispatchSettingsBusy}
//                     onClick={() => void toggleDispatchAvailability()}
//                     aria-pressed={dispatchOnline}
//                     className="sd-toggle"
//                   >
//                     {dispatchOnline ? '● Taking orders · ऑर्डर मिल रहे हैं' : '○ Offline · ऑनलाइन होने के लिए दबाएँ'}
//                   </button>
//                 </div>
//               )}
//             </div>

//             {!loading && profile && tier && (
//               <div className="sd-tier">
//                 <div className="sd-row sd-between">
//                   <span style={{ fontSize: 12, fontWeight: 800, color: tier.color }}>🏆 {tier.label} Tier</span>
//                   {effectiveTier !== 'platinum' && <span style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 600 }}>Next: {tier.next}</span>}
//                 </div>
//                 <div className="sd-track"><div style={{ width: `${tierProgress}%`, background: tier.color }} /></div>
//                 <div className="sd-row sd-between" style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 600 }}>
//                   <span>{deliveries} deliveries</span>
//                   {effectiveTier !== 'platinum' && <span>{tier.target} needed</span>}
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* ── STATS GRID ─────────────────────────────────────────────── */}
//           <div className="sd-stats">
//             <StatCard icon={Icon.truck(17)} label="Today's Orders" value={stats?.todayOrders.toString() ?? '—'} sub="Scheduled for today" accent="#0B8A60" loading={loading} />
//             <StatCard icon={Icon.drop(17, '#0277B6')} label="Active Orders" value={stats?.pendingOrders.toString() ?? '—'} sub="Pending + In-progress" accent="#0277B6" loading={loading} />
//             <StatCard icon={Icon.wallet(17)} label="This Week" value={stats ? INR(stats.weekEarnings) : '—'} sub="Earnings (7 days)" accent="#6D28D9" loading={loading} />
//             <StatCard icon={Icon.chart(17)} label="This Month" value={stats ? INR(stats.monthEarnings) : '—'} sub={`${stats?.completionRate ?? 0}% completion rate`} accent="#9A5A06" loading={loading} />
//             <StatCard
//               icon={<>{Icon.star(16)}</>}
//               label="Your Rating"
//               value={!profile || ratingLoadState === 'loading' ? '—' : ratingLoadState === 'error' ? 'Unavailable' : profile.rating_count > 0 ? `${profile.rating.toFixed(1)} ★` : 'No reviews'}
//               sub={ratingLoadState === 'error' ? 'Could not verify review data' : profile && profile.rating_count > 0 ? `Based on ${profile.rating_count} customer reviews` : ratingLoadState === 'loaded' ? 'No customer reviews yet' : 'Loading verified review data'}
//               accent="#B45309"
//               loading={loading}
//             />
//             <StatCard icon={Icon.truck(17)} label="Total Deliveries" value={profile ? deliveries.toLocaleString('en-IN') : '—'} sub={`${INR(earnedTotal)} earned`} accent="#0B8A60" loading={loading} />
//           </div>

//           {/* ── TODAY'S ROUTE + ALERTS ─────────────────────────────────── */}
//           {!loading && profile && (
//             <section aria-label="Today's delivery route" style={{ marginBottom: 28 }}>
//               {!dispatchOnline && (
//                 <div role="status" className="sd-alert sd-alert--warn">
//                   <span>You are offline, so new orders will not be offered to you.</span>
//                   <button type="button" disabled={dispatchSettingsBusy} onClick={() => void toggleDispatchAvailability()} className="sd-btn sd-btn--primary sd-btn--sm">Go online</button>
//                 </div>
//               )}
//               {lowStock && stock && (
//                 <div role="alert" className="sd-alert sd-alert--bad">
//                   ⚠ Low stock: only {freeCans} free can{freeCans === 1 ? '' : 's'} left (alert level {stock.low_stock_alert}). Restock to keep receiving orders.
//                 </div>
//               )}
//               <div className="sd-section-label">Today&apos;s route</div>
//               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
//                 <MiniStat label="Deliveries today" value={String(route.todays)} tone="var(--ink)" />
//                 <MiniStat label="Cans to deliver" value={String(route.cans)} tone="#0277B6" />
//                 <MiniStat label="Cash to collect" value={INR(route.cash)} tone="#9A5A06" />
//                 <MiniStat label="Needs accept" value={String(route.awaiting)} tone={route.awaiting > 0 ? '#0369A1' : 'var(--ink)'} />
//                 {route.overdue > 0 && <MiniStat label="Overdue" value={String(route.overdue)} tone="#B91C1C" />}
//               </div>
//               {route.slots.length > 0 && (
//                 <div className="sd-row sd-wrap sd-gap8" style={{ marginTop: 14 }}>
//                   {route.slots.map(([slot, count]) => (
//                     <span key={slot} className="sd-chip sd-chip--soft">⏰ {slot} · {count}</span>
//                   ))}
//                 </div>
//               )}
//             </section>
//           )}

//           {/* ── INVENTORY + DISPATCH CONTROLS ─────────────────────────── */}
//           <section className="sd-panels">
//             <div className="sd-card sd-panel">
//               <div className="sd-row sd-between sd-wrap sd-top" style={{ gap: 14 }}>
//                 <div>
//                   <div className="sd-panel-label" style={{ color: 'var(--aqua)' }}>Live inventory</div>
//                   <div className="sd-big">{stock ? stock.cans_available.toLocaleString('en-IN') : '—'} cans</div>
//                   <div className="sd-help" style={{ marginTop: 4, fontSize: 12 }}>
//                     {stock ? `${stock.reserved_cans} reserved (बुक हुए) · ${Math.max(0, stock.cans_available - stock.reserved_cans)} free before buffer (उपलब्ध)` : 'Loading inventory… · स्टॉक लोड हो रहा है'}
//                   </div>
//                   {stock && stock.cans_available > 0 && (
//                     <div aria-hidden="true" className="sd-meter">
//                       <div style={{ width: `${Math.min(100, (stock.reserved_cans / stock.cans_available) * 100)}%`, background: '#0EA5E9' }} />
//                       <div style={{ flex: 1, background: lowStock ? '#F59E0B' : '#10B981' }} />
//                     </div>
//                   )}
//                 </div>
//                 <div style={{ minWidth: 210, flex: '1 1 210px', maxWidth: 300 }}>
//                   <div className="sd-row sd-gap8">
//                     <input
//                       value={stockDelta}
//                       onChange={(e) => setStockDelta(e.target.value.replace(/[^0-9-]/g, ''))}
//                       inputMode="numeric"
//                       placeholder="Offline sale / restock"
//                       aria-label="Stock adjustment quantity"
//                       className="sd-input"
//                     />
//                     <button
//                       type="button"
//                       disabled={stockBusy || !Number.isInteger(Number(stockDelta)) || Number(stockDelta) === 0}
//                       onClick={() => void adjustStock(Number(stockDelta))}
//                       className="sd-btn sd-btn--primary"
//                     >
//                       Adjust
//                     </button>
//                   </div>
//                   <div className="sd-help" style={{ marginTop: 7 }}>Use negative values for offline sales, positive values for restocking.</div>
//                 </div>
//               </div>
//               <div className="sd-row sd-wrap sd-gap8" style={{ marginTop: 16 }}>
//                 <button type="button" disabled={stockBusy} onClick={() => void adjustStock(-1)} className="sd-btn sd-btn--danger sd-btn--sm">−1 offline sale</button>
//                 <button type="button" disabled={stockBusy} onClick={() => void adjustStock(10)} className="sd-btn sd-btn--info sd-btn--sm">+10 restock</button>
//                 <span style={{ alignSelf: 'center', fontSize: 11, fontWeight: 600, color: stock && stock.cans_available - stock.reserved_cans <= stock.low_stock_alert ? '#9A5A06' : 'var(--ink3)' }}>
//                   Low-stock alert: {stock?.low_stock_alert ?? '—'}
//                 </span>
//                 <label className="sd-row sd-gap6 sd-help">
//                   Alert
//                   <input value={lowStockInput} onChange={(e) => setLowStockInput(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="Low stock alert threshold" className="sd-input sd-input--sm" />
//                 </label>
//                 <label className="sd-row sd-gap6 sd-help">
//                   Buffer
//                   <input value={bufferInput} onChange={(e) => setBufferInput(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="Reservation buffer cans" className="sd-input sd-input--sm" />
//                 </label>
//                 <button
//                   type="button"
//                   disabled={stockBusy || !stock}
//                   onClick={() => void updateStockControls({
//                     low_stock_alert: Math.max(0, Math.floor(Number(lowStockInput || 0))),
//                     reservation_buffer_cans: Math.max(0, Math.floor(Number(bufferInput || 0))),
//                   })}
//                   className="sd-btn sd-btn--soft sd-btn--sm"
//                 >
//                   Save
//                 </button>
//               </div>
//             </div>

//             <div className="sd-card sd-panel">
//               <div className="sd-panel-label" style={{ color: 'var(--brand2)' }}>Dispatch control</div>
//               <div className="sd-row sd-between" style={{ marginTop: 10, gap: 10 }}>
//                 <div>
//                   <div style={{ fontSize: 14, fontWeight: 700 }}>Accept nearby orders</div>
//                   <div className="sd-help" style={{ marginTop: 4 }}>
//                     {dispatchOnline ? 'You are visible to dispatch.' : 'You are hidden from new dispatch offers.'}
//                   </div>
//                 </div>
//                 <button
//                   type="button"
//                   disabled={dispatchSettingsBusy}
//                   onClick={() => void toggleDispatchAvailability()}
//                   aria-pressed={dispatchOnline}
//                   className="sd-toggle"
//                   style={{ padding: '9px 16px', fontSize: 12 }}
//                 >
//                   {dispatchSettingsBusy ? '…' : dispatchOnline ? 'Online' : 'Offline'}
//                 </button>
//               </div>
//               <div className="sd-help" style={{ marginTop: 12 }}>
//                 Orders reserve cans atomically. Offline sales cannot reduce inventory below reserved stock.
//               </div>
//               <button type="button" disabled={locationBusy} onClick={() => void syncDispatchLocation()} className="sd-btn sd-btn--info sd-btn--block" style={{ marginTop: 16 }}>
//                 {locationBusy ? 'Updating location…' : 'Use current location for dispatch'}
//               </button>
//             </div>
//           </section>

//           {/* ── ORDERS SECTION ─────────────────────────────────────────── */}
//           <div style={{ marginBottom: 28 }}>
//             <div className="sd-row sd-between sd-wrap" style={{ gap: 12, marginBottom: 18 }}>
//               <div className="sd-seg" role="tablist" aria-label="Order lists">
//                 {(['active', 'history'] as const).map((t) => (
//                   <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
//                     {t === 'active' ? 'Active Orders' : 'History'}
//                     <span className="sd-count">{t === 'active' ? activeOrders.length : historyOrders.length}</span>
//                   </button>
//                 ))}
//               </div>

//               <div className="sd-live">
//                 {tab === 'active' ? (
//                   <span role="status" aria-live="polite" className="sd-live">
//                     <span className="sd-dot" style={{ background: realtimeStatus === 'live' ? '#10B981' : realtimeStatus === 'connecting' ? '#F59E0B' : '#EF4444', boxShadow: realtimeStatus === 'live' ? '0 0 8px #10B981' : 'none' }} />
//                     {realtimeStatus === 'live' ? 'Live · instant updates' : realtimeStatus === 'connecting' ? 'Connecting…' : 'Reconnecting · refreshing every 10s'}
//                   </span>
//                 ) : `${historyOrders.length} completed orders`}
//               </div>
//             </div>

//             <div className="sd-row sd-wrap sd-gap8" style={{ marginBottom: 16 }}>
//               <input
//                 type="search"
//                 value={query}
//                 onChange={(e) => setQuery(e.target.value)}
//                 placeholder="Search name, phone, order ID, area…"
//                 aria-label="Search orders"
//                 className="sd-input"
//                 style={{ flex: '1 1 220px' }}
//               />
//               {tab === 'active' && (Object.keys(FILTER_LABELS) as OrderFilter[]).map((f) => (
//                 <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="sd-filter">
//                   {FILTER_LABELS[f]}
//                 </button>
//               ))}
//             </div>

//             {loadingOrders ? (
//               <div className="sd-orders">
//                 {Array.from({ length: 4 }).map((_, i) => (
//                   <div key={i} className="sd-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
//                     <Skeleton h={16} w="60%" />
//                     <Skeleton h={60} />
//                     <Skeleton h={12} w="80%" />
//                     <Skeleton h={42} r={12} />
//                   </div>
//                 ))}
//               </div>
//             ) : displayOrders.length === 0 ? (
//               <div className="sd-empty">
//                 <div style={{ fontSize: 38, marginBottom: 12 }}>{tab === 'active' ? '💧' : '📦'}</div>
//                 <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
//                   {hasFilter ? 'No orders match your search' : tab === 'active' ? 'No active orders right now' : 'No order history yet'}
//                 </div>
//                 <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
//                   {hasFilter
//                     ? 'Try a different name, phone number or filter.'
//                     : tab === 'active'
//                       ? 'New orders will appear here automatically when assigned.'
//                       : 'Completed and cancelled orders will show up here.'}
//                 </div>
//                 {hasFilter && (
//                   <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="sd-btn sd-btn--soft" style={{ marginTop: 16 }}>
//                     Clear filters
//                   </button>
//                 )}
//               </div>
//             ) : (
//               <div className="sd-orders">
//                 {displayOrders.map((o) => (
//                   <OrderCard
//                     key={o.id}
//                     order={o}
//                     onAccept={handleAcceptOrder}
//                     onUpdateStatus={handleUpdateStatus}
//                     onRequestComplete={(order) => {
//                       setCompletionOrder(order);
//                       setPaymentReference('');
//                       setPaymentConfirmed(false);
//                       setPaymentCollector('supplier');
//                     }}
//                     updating={updatingOrder}
//                   />
//                 ))}
//               </div>
//             )}
//           </div>

//           {completionOrder && (
//             <div
//               role="dialog"
//               aria-modal="true"
//               aria-labelledby="complete-order-title"
//               className="sd-scrim"
//               onMouseDown={(event) => {
//                 if (event.target === event.currentTarget && !updatingOrder) {
//                   setCompletionOrder(null);
//                 }
//               }}
//             >
//               <div className="sd-modal">
//                 <div className="sd-row sd-between sd-top" style={{ gap: 16 }}>
//                   <div>
//                     <div className="sd-eyebrow" style={{ marginBottom: 0 }}>Final delivery step</div>
//                     <h2 id="complete-order-title" style={{ margin: '6px 0 0', fontSize: 21, fontWeight: 800 }}>Confirm completion</h2>
//                     <p style={{ margin: '7px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--ink2)' }}>
//                       Confirm the service is complete and record payment before closing this order.
//                     </p>
//                   </div>
//                   <button
//                     type="button"
//                     aria-label="Close completion dialog"
//                     disabled={Boolean(updatingOrder)}
//                     onClick={() => setCompletionOrder(null)}
//                     className="sd-iconbtn"
//                     style={{ flexShrink: 0, fontSize: 20 }}
//                   >
//                     ×
//                   </button>
//                 </div>

//                 <div className="sd-well" style={{ marginTop: 18, padding: 14, gap: 4 }}>
//                   <div className="sd-row sd-between" style={{ gap: 12 }}>
//                     <div>
//                       <div style={{ fontSize: 13, fontWeight: 800 }}>{completionOrder.service_type}</div>
//                       <div className="sd-help" style={{ marginTop: 3 }}>
//                         #{completionOrder.booking_id.slice(0, 8).toUpperCase()} · {completionOrder.customer_name}
//                       </div>
//                     </div>
//                     <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand2)' }}>{INR(completionOrder.amount)}</div>
//                   </div>
//                   <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink2)' }}>
//                     Payment method: <strong style={{ color: 'var(--ink)' }}>{completionOrder.payment_method?.toUpperCase() || 'CASH'}</strong>
//                   </div>
//                   <div style={{ fontSize: 12, color: 'var(--ink2)' }}>
//                     Payment status: <strong style={{ color: completionOrder.payment_status === 'paid' ? '#047857' : '#9A5A06' }}>
//                       {completionOrder.payment_status === 'paid' ? 'Already paid' : 'Confirmation required'}
//                     </strong>
//                   </div>
//                 </div>

//                 {completionOrder.payment_status !== 'paid' && (
//                   <>
//                     <label>
//                       <span className="sd-label">Who collected the payment?</span>
//                       <select
//                         value={paymentCollector}
//                         onChange={(event) => setPaymentCollector(event.target.value === 'aurotap' ? 'aurotap' : 'supplier')}
//                         disabled={Boolean(updatingOrder)}
//                         className="sd-input"
//                         style={{ minHeight: 46 }}
//                       >
//                         <option value="supplier">Supplier collected directly</option>
//                         <option value="aurotap">AuroTap collected</option>
//                       </select>
//                     </label>
//                     {completionOrder.payment_method?.toLowerCase() === 'upi' && (
//                       <label>
//                         <span className="sd-label">UPI transaction reference</span>
//                         <input
//                           value={paymentReference}
//                           onChange={(event) => setPaymentReference(event.target.value.slice(0, 100))}
//                           placeholder="Enter UPI / transaction ID"
//                           maxLength={100}
//                           disabled={Boolean(updatingOrder)}
//                           autoComplete="off"
//                           className="sd-input"
//                           style={{ minHeight: 46 }}
//                         />
//                       </label>
//                     )}

//                     <label className="sd-check" style={{ cursor: updatingOrder ? 'wait' : 'pointer' }}>
//                       <input
//                         type="checkbox"
//                         checked={paymentConfirmed}
//                         onChange={(event) => setPaymentConfirmed(event.target.checked)}
//                         disabled={Boolean(updatingOrder)}
//                       />
//                       <span>I confirm the customer has paid the order amount and the payment details are accurate.</span>
//                     </label>
//                   </>
//                 )}

//                 <div className="sd-row" style={{ gap: 12, marginTop: 22 }}>
//                   <button type="button" disabled={Boolean(updatingOrder)} onClick={() => setCompletionOrder(null)} className="sd-btn sd-btn--soft" style={{ flex: 1, minHeight: 48 }}>
//                     Cancel
//                   </button>
//                   <button
//                     type="button"
//                     disabled={Boolean(updatingOrder) || (completionOrder.payment_status !== 'paid' && (!paymentConfirmed || (completionOrder.payment_method?.toLowerCase() === 'upi' && !paymentReference.trim())))}
//                     onClick={async () => {
//                       const ok = await handleUpdateStatus(
//                         completionOrder.id,
//                         'delivered',
//                         completionOrder.payment_status === 'paid'
//                           ? undefined
//                           : {
//                               payment_confirmed: true,
//                               payment_reference: paymentReference.trim() || undefined,
//                               payment_collector: paymentCollector,
//                             },
//                       );

//                       if (ok) {
//                         setCompletionOrder(null);
//                         setPaymentReference('');
//                         setPaymentConfirmed(false);
//                       }
//                     }}
//                     className="sd-btn sd-btn--primary"
//                     style={{ flex: 1.35, minHeight: 48 }}
//                   >
//                     {updatingOrder ? 'Completing…' : 'Confirm & Complete'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* ── EARNINGS SUMMARY + TABLE ─────────────────────────────────── */}
//           <section aria-label="Supplier earnings" style={{ marginBottom: 24 }}>
//             <div className="sd-row sd-between sd-wrap" style={{ gap: 12, marginBottom: 12 }}>
//               <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>Earnings summary <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>· कमाई का विवरण</span></h2>
//               <button type="button" className="sd-btn sd-btn--soft sd-btn--sm" onClick={() => {
//                 if (!exportEarningsCsv(earnings)) toast.info('No recent earnings rows available to export yet.');
//               }}>
//                 Export recent CSV ({earnings.length})
//               </button>
//             </div>
//             <div className="sd-stats" style={{ marginBottom: 16 }}>
//               <StatCard icon={Icon.wallet(17)} label="This month" value={earningsSummary ? INR(earningsSummary.gross_amount) : '—'} sub={earningsSummary ? `${earningsSummary.order_count} orders counted by finance ledger` : 'Summary temporarily unavailable'} accent="#6D28D9" loading={loading} />
//               <StatCard icon={Icon.chart(17)} label="Pending payout" value={earningsSummary ? INR(earningsSummary.pending_payout) : '—'} sub="From the supplier earnings ledger" accent="#9A5A06" loading={loading} />
//             </div>
//           </section>
//           {earnings.length > 0 && (
//             <div>
//               <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>Recent Earnings (latest 50 loaded rows)</h2>
//               <div className="sd-table">
//                 <div className="sd-earn sd-earn--head">
//                   {['Order', 'Amount', 'Status', 'Date'].map((h) => <div key={h}>{h}</div>)}
//                 </div>
//                 {earnings.slice(0, 10).map((e) => (
//                   <div key={e.id} className="sd-earn">
//                     <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>#{e.order_id.slice(0, 8).toUpperCase()}</div>
//                     <div style={{ fontSize: 13, fontWeight: 800, color: e.status === 'review' ? '#B91C1C' : 'var(--brand2)' }}>{e.amount > 0 ? INR(e.amount) : 'Unverified'}</div>
//                     <div>
//                       <span className={`sd-chip ${e.status === 'paid' ? 'sd-chip--ok' : e.status === 'review' ? 'sd-chip--bad' : 'sd-chip--warn'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
//                         {e.status === 'paid' ? 'Paid' : e.status === 'review' ? 'Needs review' : 'Pending'}
//                       </span>
//                     </div>
//                     <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{e.paid_at ? fmtDate(e.paid_at) : fmtDate(e.created_at)}</div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
//         </main>
//       </div>
//     </>
//   );
// }










'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  supplierOrderAccept,
  supplierOrderUpdateStatus,
  supplierOrdersList,
  supplierStockGet,
  supplierStockUpdate,
  supplierSettingsGet,
  supplierSettingsUpdate,
  supplierEarningsSummary,
  supplierRatingGet,
} from '@/lib/api-client';
import { useSupplierRealtime } from '@/hooks/useSupplierRealtime';

// ─── Types ───────────────────────────────────────────────────

type SupplierProfile = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  city: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  is_active: boolean;
  is_verified: boolean;
  total_deliveries: number;
  total_earnings: number;
  rating: number;
  rating_count: number;
  created_at: string;
};

type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'delivered'
  | 'cancelled';

type Order = {
  id: string;
  booking_id: string;
  service_type: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  city: string;
  scheduled_date: string;
  scheduled_slot: string;
  status: OrderStatus;
  amount: number;
  cans_count: number | null;
  notes: string | null;
  created_at: string;
  accepted_at?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
};

type EarningRow = {
  id: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'review';
  paid_at: string | null;
  created_at: string;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type DashboardStats = {
  todayOrders: number;
  pendingOrders: number;
  weekEarnings: number;
  monthEarnings: number;
  completionRate: number;
  avgRating: number;
};

type SupplierStockState = {
  supplier_id: string;
  cans_available: number;
  reserved_cans: number;
  low_stock_alert: number;
  reservation_buffer_cans: number;
  updated_at: string;
};


// ─── Constants ────────────────────────────────────────────────────────────────
// Colours are tuned for the light "water" surface (text colours keep ≥4.5:1 contrast).

const TIER_META: Record<
  SupplierProfile['tier'],
  { label: string; color: string; bg: string; next: string; target: number }
> = {
  bronze: { label: 'Bronze', color: '#9A5B13', bg: 'rgba(205,127,50,0.16)', next: 'Silver', target: 50 },
  silver: { label: 'Silver', color: '#566579', bg: 'rgba(100,116,139,0.16)', next: 'Gold', target: 150 },
  gold: { label: 'Gold', color: '#A16207', bg: 'rgba(234,179,8,0.20)', next: 'Platinum', target: 400 },
  platinum: { label: 'Platinum', color: '#3B5B7A', bg: 'rgba(59,91,122,0.16)', next: '—', target: 400 },
};

const STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; bg: string }
> = {
  pending: { label: 'Pending', color: '#9A5A06', bg: 'rgba(245,158,11,0.18)' },
  assigned: { label: 'Assigned', color: '#0369A1', bg: 'rgba(14,165,233,0.16)' },
  in_progress: { label: 'In Progress', color: '#6D28D9', bg: 'rgba(124,58,237,0.14)' },
  delivered: { label: 'Delivered', color: '#047857', bg: 'rgba(16,185,129,0.16)' },
  cancelled: { label: 'Cancelled', color: '#B91C1C', bg: 'rgba(239,68,68,0.14)' },
};

const INR = (n: number) =>
  `₹${Math.round(n).toLocaleString('en-IN')}`;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return 'Date TBD';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Database timestamps can arrive as ISO strings (often UTC). Always display
// those in India Standard Time; preserve human-entered labels such as "Morning".
const formatScheduledSlot = (value: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Time not specified';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const formatted = fmtTime(raw);
    return formatted || 'Time not specified';
  }
  return raw;
};

// Normalize date-only values without shifting them. Convert timestamps to India-local dates.
const toISTDateKey = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = !hasTimezone && /^\d{4}-\d{2}-\d{2}[T ]/.test(raw)
    ? `${raw.replace(' ', 'T')}+05:30`
    : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};
const todayIST = () => toISTDateKey(new Date().toISOString());
const tomorrowIST = () => {
  const [year, month, day] = todayIST().split('-').map(Number);
  if (!year || !month || !day) return '';
  return toISTDateKey(new Date(Date.UTC(year, month - 1, day + 1, 12)).toISOString());
};
const exportEarningsCsv = (rows: EarningRow[]) => {
  if (!rows.length) return false;
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Order ID', 'Amount INR', 'Payout status', 'Created at', 'Paid at'].map(cell).join(','),
    ...rows.map((row) => [row.order_id, Number.isFinite(row.amount) ? row.amount.toFixed(2) : '0.00', row.status, row.created_at, row.paid_at ?? ''].map(cell).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aurotap-supplier-earnings-recent-${todayIST()}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};

const cleanPhone = (p: string) => p.replace(/[^\d+]/g, '');

const waLink = (phone: string, text: string) => {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  const num = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
};

const mapsLink = (addr: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

const TIER_RANK: SupplierProfile['tier'][] = ['bronze', 'silver', 'gold', 'platinum'];

const normalizeOrderStatus = (status: unknown): OrderStatus => {
  switch (String(status ?? '').toUpperCase()) {
    case 'ASSIGNED': return 'assigned';
    case 'IN_PROGRESS': return 'in_progress';
    case 'COMPLETED':
    case 'DELIVERED': return 'delivered';
    case 'CANCELLED': return 'cancelled';
    case 'PENDING':
    default: return 'pending';
  }
};


// ─── SVG Icons/ ────────────────────────────────────────────────────────────────

const Icon = {
  drop: (s = 18, c = '#0D9B6C') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C12 2 5 9.5 5 14.5C5 18.09 8.13 21 12 21C15.87 21 19 18.09 19 14.5C19 9.5 12 2 12 2Z"
        fill={c}
        opacity="0.2"
        stroke={c}
        strokeWidth="1.5"
      />
      <path d="M9 15.5C9.5 17.5 11 18.5 13 18" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  wallet: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" />
    </svg>
  ),
  truck: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M1 3h13v13H1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="5.5" cy="18.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18.5" cy="18.5" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  star: (s = 14, filled = true) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <polygon
        points="7,1 8.8,5.2 13,5.6 10,8.4 10.9,12.5 7,10.3 3.1,12.5 4,8.4 1,5.6 5.2,5.2"
        fill={filled ? '#F59E0B' : 'rgba(255,255,255,0.12)'}
      />
    </svg>
  ),
  bell: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  chart: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 16l4-4 4 4 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  logout: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  map: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 1C4.8 1 3 2.8 3 5c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  phone: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="3.5" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="10.5" r="0.7" fill="currentColor" />
    </svg>
  ),
  refresh: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M23 4v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 20v-6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const DASHBOARD_CSS = `
.sdash{
  --bg:#E4EDF5; --bg2:#EDF4FA; --sh-hi:rgba(255,255,255,.95); --sh-lo:rgba(132,155,182,.50);
  --ink:#0F2A43; --ink2:#41607D; --ink3:#587490;
  --brand:#0B8A60; --brand2:#08694B; --aqua:#0277B6; --amber:#9A5A06; --rose:#B91C1C;
  --r-lg:20px; --r-md:14px; --r-sm:10px;
  --raise:6px 6px 14px var(--sh-lo),-6px -6px 14px var(--sh-hi);
  --raise-sm:3px 3px 8px var(--sh-lo),-3px -3px 8px var(--sh-hi);
  --inset:inset 3px 3px 7px var(--sh-lo),inset -3px -3px 7px var(--sh-hi);
  min-height:100vh; color:var(--ink); color-scheme:light;
  background:linear-gradient(180deg,#D9E9F4 0%,var(--bg) 280px,var(--bg) 100%);
  font-family:var(--font-sans),'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-tap-highlight-color:transparent; text-rendering:optimizeLegibility;
}
.sdash *{box-sizing:border-box;font-family:inherit}
.sdash h1,.sdash h2{font-family:var(--font-display),var(--font-sans),system-ui,sans-serif}
.sdash :where(button,input,select){font:inherit;color:inherit}
.sdash :where(button){cursor:pointer;touch-action:manipulation}
.sdash :where(button):disabled{cursor:not-allowed}
.sdash :focus-visible{outline:2px solid var(--aqua);outline-offset:3px}

/* layout helpers */
.sd-row{display:flex;align-items:center}.sd-col{display:flex;flex-direction:column}
.sd-between{justify-content:space-between}.sd-wrap{flex-wrap:wrap}.sd-end{align-items:flex-end}.sd-top{align-items:flex-start}
.sd-gap6{gap:6px}.sd-gap8{gap:8px}
.sd-muted-ico{color:var(--ink3);display:inline-flex}

/* surfaces */
.sd-card{background:var(--bg);border-radius:var(--r-lg);box-shadow:var(--raise)}
.sd-well{background:var(--bg);border-radius:var(--r-md);box-shadow:var(--inset);padding:11px 13px;display:flex;flex-direction:column;gap:7px}
.sd-skel{background:#D3DFEB;animation:sd-pulse 1.3s ease-in-out infinite;flex-shrink:0}
@keyframes sd-pulse{50%{opacity:.5}}
@keyframes sd-spin{to{transform:rotate(360deg)}}
.sd-spin{animation:sd-spin .8s linear infinite}

/* header */
.sdash .sd-header{position:sticky;top:48px;z-index:50;background:var(--bg);box-shadow:0 6px 14px -8px var(--sh-lo);padding:0 clamp(14px,4vw,32px)}
.sd-header-in{max-width:1200px;margin:0 auto;height:58px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.sd-logo{width:36px;height:36px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#12A875,#08694B);box-shadow:var(--raise-sm)}
.sd-brand{font-size:15px;font-weight:800;letter-spacing:-.3px;line-height:1;color:var(--ink)}
.sd-brand-sub{font-size:10px;font-weight:700;color:var(--brand);letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
.sd-iconbtn{width:38px;height:38px;border-radius:12px;border:0;background:var(--bg);box-shadow:var(--raise-sm);display:flex;align-items:center;justify-content:center;color:var(--ink2);position:relative;transition:box-shadow .15s,color .15s}
.sd-iconbtn:hover{color:var(--ink)}
.sd-iconbtn:active{box-shadow:var(--inset)}
.sd-iconbtn--danger{color:var(--rose)}
.sd-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#DC2626;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--bg)}
.sd-pill{display:flex;align-items:center;gap:8px;border-radius:12px;padding:5px;background:var(--bg);box-shadow:var(--inset)}
.sd-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0}
.sd-pill-name{display:none;min-width:0;padding-right:6px}
.sd-pill-name b{display:block;font-size:12px;font-weight:700;line-height:1.1;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sd-pill-name i{display:block;font-style:normal;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.sd-sub{display:none}
.sd-notif{position:absolute;top:46px;right:-86px;width:min(320px,calc(100vw - 24px));background:var(--bg);border-radius:var(--r-lg);box-shadow:0 18px 40px -10px rgba(15,42,67,.35),var(--raise);z-index:100;overflow:hidden}
.sd-notif-head{padding:13px 16px;font-size:12px;font-weight:800;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 8px -6px var(--sh-lo)}
.sd-notif-item{padding:12px 16px;border-bottom:1px solid rgba(132,155,182,.22)}
.sd-notif-item.unread{background:rgba(11,138,96,.07)}
.sd-notif-item b{font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:3px}
.sd-notif-item p{margin:0;font-size:11px;color:var(--ink2);line-height:1.5}
.sd-notif-item time{display:block;font-size:10px;color:var(--ink3);margin-top:4px}

/* main */
.sd-main{max-width:1200px;margin:0 auto;padding:clamp(18px,4vw,30px) clamp(14px,4vw,24px) 80px}
.sd-hero{position:relative;overflow:hidden;border-radius:24px;padding:clamp(16px,3.5vw,28px);margin-bottom:22px;display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;
  background:radial-gradient(120% 140% at 100% 0%,rgba(2,119,182,.14),transparent 55%),radial-gradient(90% 120% at 0% 100%,rgba(11,138,96,.12),transparent 60%),var(--bg);
  box-shadow:var(--raise)}
.sd-hero::after{content:'';position:absolute;right:-50px;bottom:-70px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(2,119,182,.10),transparent 70%);pointer-events:none}
.sd-eyebrow{font-size:11px;font-weight:800;color:var(--brand);letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
.sd-h1{margin:0;font-size:clamp(1.4rem,4.5vw,2rem);font-weight:800;letter-spacing:-.6px;line-height:1.1;color:var(--ink)}
.sd-tier{position:relative;z-index:1;border-radius:var(--r-md);padding:14px 18px;box-shadow:var(--inset);width:100%;min-width:0}
.sd-track{height:8px;border-radius:99px;background:var(--bg);box-shadow:var(--inset);overflow:hidden;margin:10px 0 7px}
.sd-track>div{height:100%;border-radius:99px;transition:width .6s ease}

/* chips & buttons */
.sd-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap;line-height:1.3}
.sd-chip--soft{color:var(--ink2);background:rgba(132,155,182,.18)}
.sd-chip--ok{color:#047857;background:rgba(16,185,129,.16)}
.sd-chip--warn{color:#9A5A06;background:rgba(245,158,11,.18)}
.sd-chip--bad{color:#B91C1C;background:rgba(239,68,68,.14)}
.sd-chip--info{color:#0369A1;background:rgba(14,165,233,.16)}
.sd-btn{border:0;border-radius:12px;min-height:42px;padding:0 16px;font-weight:800;font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:box-shadow .15s,transform .15s,filter .15s}
.sd-btn--block{width:100%}
.sd-btn--primary{color:#fff;background:linear-gradient(145deg,#12A875,#08694B);box-shadow:4px 4px 10px rgba(8,105,75,.35),-3px -3px 8px var(--sh-hi)}
.sd-btn--primary:hover:not(:disabled){filter:brightness(1.06)}
.sd-btn--primary:active:not(:disabled){transform:translateY(1px);box-shadow:inset 2px 2px 6px rgba(0,0,0,.25)}
.sd-btn--info{color:#035E8E;background:var(--bg);box-shadow:var(--raise-sm)}
.sd-btn--soft{color:var(--ink);background:var(--bg);box-shadow:var(--raise-sm)}
.sd-btn--danger{color:var(--rose);background:var(--bg);box-shadow:var(--raise-sm)}
.sd-btn--info:active:not(:disabled),.sd-btn--soft:active:not(:disabled),.sd-btn--danger:active:not(:disabled){box-shadow:var(--inset)}
.sd-btn:disabled{opacity:.6}
.sd-btn--sm{min-height:36px;padding:0 12px;font-size:12px}
.sd-toggle{border:0;border-radius:999px;padding:5px 13px;font-size:11px;font-weight:800;background:var(--bg);box-shadow:var(--raise-sm);color:var(--ink2);transition:box-shadow .15s}
.sd-toggle[aria-pressed="true"]{box-shadow:var(--inset);color:#047857}

/* inputs: recessed */
.sd-input{width:100%;min-width:0;min-height:42px;border:0;border-radius:12px;background:var(--bg);box-shadow:var(--inset);padding:0 13px;color:var(--ink);font-size:13px}
.sd-input::placeholder{color:var(--ink3)}
.sd-input:focus{outline:2px solid var(--aqua);outline-offset:2px}
.sd-input--sm{width:62px;min-height:34px;padding:0 8px;border-radius:10px}

/* stats */
.sd-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:24px}
.sd-stat{padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.sd-stat-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
.sd-stat-label{font-size:12px;font-weight:700;color:var(--ink2);letter-spacing:.02em;min-width:0}
.sd-stat-icon{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--accent);box-shadow:var(--inset);flex-shrink:0}
.sd-stat-val{font-size:20px;font-weight:800;letter-spacing:-.5px;line-height:1;color:var(--ink);overflow-wrap:anywhere}
.sd-stat-sub{font-size:11px;color:var(--ink3);font-weight:500}
.sd-section-label{font-size:11px;font-weight:800;color:var(--brand2);letter-spacing:.1em;margin-bottom:10px;text-transform:uppercase}
.sd-mini{padding:12px 14px;border-radius:var(--r-md)}
.sd-mini-label{font-size:10px;font-weight:800;color:var(--ink3);letter-spacing:.06em;text-transform:uppercase}
.sd-mini-val{margin-top:6px;font-size:20px;font-weight:800}
.sd-alert{margin-bottom:12px;padding:12px 14px;border-radius:var(--r-md);box-shadow:var(--inset);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:600}
.sd-alert--warn{color:#8A4F05;background:rgba(245,158,11,.10)}
.sd-alert--bad{color:#9B1C1C;background:rgba(239,68,68,.07)}

/* inventory + dispatch */
.sd-panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;margin-bottom:28px}
.sd-panel{padding:18px}
.sd-panel-label{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.sd-big{margin-top:5px;font-size:26px;font-weight:800;letter-spacing:-.5px}
.sd-help{font-size:11px;color:var(--ink3);line-height:1.5}
.sd-meter{margin-top:10px;height:8px;width:min(100%,260px);border-radius:99px;box-shadow:var(--inset);overflow:hidden;display:flex;background:var(--bg)}

/* tabs / filters */
.sd-seg{display:inline-flex;gap:4px;padding:4px;border-radius:14px;box-shadow:var(--inset);background:var(--bg)}
.sd-seg button{border:0;border-radius:10px;padding:8px 16px;background:transparent;color:var(--ink2);font-weight:700;font-size:13px;display:flex;align-items:center;gap:7px;transition:box-shadow .15s,color .15s}
.sd-seg button[aria-selected="true"]{background:var(--bg);box-shadow:var(--raise-sm);color:var(--brand2)}
.sd-count{font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;min-width:22px;text-align:center;background:rgba(132,155,182,.22);color:var(--ink2)}
.sd-seg button[aria-selected="true"] .sd-count{background:rgba(11,138,96,.16);color:var(--brand2)}
.sd-filter{min-height:36px;padding:0 13px;border-radius:999px;border:0;background:var(--bg);box-shadow:var(--raise-sm);color:var(--ink2);font-weight:700;font-size:12px;transition:box-shadow .15s}
.sd-filter[aria-pressed="true"]{box-shadow:var(--inset);color:var(--brand2)}
.sd-live{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--ink3);font-weight:600}
.sd-dot{width:8px;height:8px;border-radius:50%}

/* orders */
.sd-orders{display:grid;grid-template-columns:1fr;gap:16px}
.sd-order{position:relative;overflow:hidden;content-visibility:auto;contain-intrinsic-size:auto 330px;transition:transform .18s}
.sd-order:hover{transform:translateY(-2px)}
.sd-order-stripe{position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:var(--st)}
.sd-order-body{padding:16px 18px 18px 20px;display:flex;flex-direction:column;gap:12px}
.sd-order-title{font-size:14px;font-weight:800;letter-spacing:-.2px}
.sd-order-id{font-size:11px;color:var(--ink3);margin-top:2px;font-weight:600}
.sd-amount{font-size:15px;font-weight:800;color:var(--brand2)}
.sd-wellrow{font-size:12px;color:var(--ink);font-weight:600;flex-wrap:wrap}
.sd-addr{font-size:11px;color:var(--ink2)}
.sd-link{color:var(--aqua);text-decoration:underline;text-underline-offset:3px;font-weight:700}
.sd-quick{flex:1 1 0;min-width:0;min-height:40px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:12px;font-size:12px;font-weight:700;text-decoration:none;color:var(--ink);background:var(--bg);box-shadow:var(--raise-sm);transition:box-shadow .15s}
.sd-quick:active{box-shadow:var(--inset)}
.sd-note{margin:0;font-size:11px;color:var(--ink2);font-style:italic;line-height:1.5;border-left:3px solid rgba(132,155,182,.45);padding-left:9px}
.sd-empty{text-align:center;padding:56px 24px;border-radius:var(--r-lg);box-shadow:var(--inset)}

/* earnings */
.sd-table{border-radius:var(--r-lg);box-shadow:var(--inset);overflow:hidden;padding:6px}
.sd-earn{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;align-items:center;column-gap:6px;padding:12px 12px;border-radius:12px;transition:background .15s}
.sd-earn:not(.sd-earn--head):hover{background:rgba(255,255,255,.5)}
.sd-earn--head div{font-size:10px;font-weight:800;color:var(--ink3);letter-spacing:.08em;text-transform:uppercase}

/* completion dialog (dark scrim only where focus is needed) */
.sd-scrim{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,30,50,.62)}
.sd-modal{width:100%;max-width:460px;max-height:min(720px,calc(100vh - 32px));overflow-y:auto;background:var(--bg);border-radius:24px;box-shadow:0 30px 80px rgba(5,20,35,.5),var(--raise);padding:22px}
.sd-check{display:flex;align-items:flex-start;gap:10px;margin-top:16px;padding:13px;border-radius:var(--r-md);cursor:pointer;box-shadow:var(--inset);font-size:12px;line-height:1.55;color:var(--ink2)}
.sd-check input{margin-top:2px;accent-color:var(--brand);width:18px;height:18px;flex-shrink:0}
.sd-label{display:block;margin:16px 0 7px;font-size:11px;font-weight:800;color:var(--ink2)}

@media (min-width:560px){
  .sd-pill{padding:5px 8px 5px 5px}.sd-pill-name{display:block}.sd-sub{display:block}.sd-notif{right:0}
}
@media (min-width:720px){
  .sd-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .sd-stat{padding:18px 20px;gap:12px}.sd-stat-val{font-size:24px}.sd-stat-icon{width:34px;height:34px}
  .sd-tier{width:auto;min-width:250px}
  .sd-orders{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
}
@media (min-width:1080px){
  .sd-stats{grid-template-columns:repeat(6,minmax(0,1fr))}.sd-stat{padding:16px}.sd-stat-val{font-size:22px}
}
@media (max-width:420px){.sd-earn{padding:11px 6px;font-size:12px}}
@media (prefers-reduced-motion:reduce){.sdash *{animation:none!important;transition:none!important}}
@media (hover:none){.sd-order:hover{transform:none}}
`;

// ─── Skeleton loader (opacity pulse: cheap on low-end phones) ─────────────────

function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return <div className="sd-skel" style={{ width: w, height: h, borderRadius: r }} />;
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className="sd-card sd-stat" style={{ '--accent': accent } as React.CSSProperties}>
      <div className="sd-stat-top">
        <span className="sd-stat-label">{label}</span>
        <div className="sd-stat-icon">{icon}</div>
      </div>
      {loading ? (
        <>
          <Skeleton h={28} w="60%" />
          <Skeleton h={12} w="80%" />
        </>
      ) : (
        <>
          <div className="sd-stat-val">{value}</div>
          {sub && <div className="sd-stat-sub">{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─── Water-delivery helpers ───────────────────────────────────────────────────

type OrderFilter = 'all' | 'today' | 'tomorrow' | 'overdue' | 'cash' | 'accept';

const FILTER_LABELS: Record<OrderFilter, string> = {
  all: 'All',
  today: 'Today',
  tomorrow: 'Tomorrow',
  overdue: 'Overdue',
  cash: 'Cash to collect',
  accept: 'Needs accept',
};

const matchesQuery = (o: Order, q: string) =>
  !q ||
  [o.customer_name, o.customer_phone, o.booking_id, o.address_line, o.city, o.service_type].some((v) =>
    String(v ?? '').toLowerCase().includes(q),
  );

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="sd-card sd-mini">
      <div className="sd-mini-label">{label}</div>
      <div className="sd-mini-val" style={{ color: tone }}>{value}</div>
    </div>
  );
}

// ─── Order card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onAccept,
  onUpdateStatus,
  onRequestComplete,
  updating,
}: {
  order: Order;
  onAccept: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, status: OrderStatus) => Promise<boolean>;
  onRequestComplete: (order: Order) => void;
  updating: string | null;
}) {
  const sm = STATUS_META[order.status];
  const isUpdating = updating === order.id;

  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    pending: null,
    assigned: order.accepted_at ? 'in_progress' : null,
    in_progress: 'delivered',
    delivered: null,
    cancelled: null,
  };

  const next = nextStatus[order.status];
  const isAssignedAndWaiting = order.status === 'assigned' && !order.accepted_at;

  const today = todayIST();
  const isActive = ['pending', 'assigned', 'in_progress'].includes(order.status);
  const canRevealContact = isActive && (order.status === 'in_progress' || (order.status === 'assigned' && Boolean(order.accepted_at)));
  const hasPhone = canRevealContact && !!order.customer_phone && order.customer_phone !== '—';
  const fullAddress = canRevealContact ? [order.address_line, order.city].filter(Boolean).join(', ') : '';
  const isToday = isActive && order.scheduled_date === today;
  const isOverdue = isActive && !!order.scheduled_date && order.scheduled_date < today;
  const isPaid = order.payment_status === 'paid';
  const payMethod = (order.payment_method || 'cash').toUpperCase();

  const nextLabel: Record<OrderStatus, string> = {
    pending: '',
    assigned: 'Start Delivery',
    in_progress: 'Complete Order',
    delivered: '',
    cancelled: '',
  };

  return (
    <article className="sd-card sd-order" style={{ '--st': sm.color } as React.CSSProperties}>
      <div className="sd-order-stripe" />

      <div className="sd-order-body">
        <div className="sd-row sd-between sd-top">
          <div style={{ minWidth: 0 }}>
            <div className="sd-order-title">{order.service_type}</div>
            <div className="sd-order-id">#{order.booking_id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div className="sd-col sd-end">
            <span className="sd-chip" style={{ color: sm.color, background: sm.bg }}>{sm.label}</span>
            <span className="sd-amount">{INR(order.amount)}</span>
          </div>
        </div>

        <div className="sd-well">
          <div className="sd-row sd-gap6 sd-wellrow">
            <span className="sd-muted-ico">{Icon.phone(12)}</span>
            <span>{order.customer_name} · </span>
            {hasPhone ? (
              <a href={`tel:${order.customer_phone.replace(/[^\d+]/g, '')}`} className="sd-link" aria-label={`Call customer ${order.customer_name}`}>
                {order.customer_phone}
              </a>
            ) : <span>{isActive ? 'Contact shown after acceptance' : 'Contact hidden for privacy'}</span>}
          </div>
          <div className="sd-row sd-gap6 sd-top sd-addr">
            <span className="sd-muted-ico" style={{ marginTop: 1, flexShrink: 0 }}>{Icon.map(11)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {canRevealContact ? (fullAddress || 'Address unavailable — refresh order details') : (isActive ? 'Exact address shown after acceptance' : 'Exact address hidden for privacy')}
            </span>
            {canRevealContact && fullAddress && (
              <button type="button" className="sd-btn sd-btn--soft sd-btn--sm" aria-label="Copy delivery address"
                onClick={() => {
                  if (!navigator.clipboard?.writeText) {
                    toast.error('Clipboard access is unavailable in this browser.');
                    return;
                  }
                  void navigator.clipboard.writeText(fullAddress)
                    .then(() => toast.success('Delivery address copied'))
                    .catch(() => toast.error('Could not copy address. Check browser clipboard permissions.'));
                }}>
                Copy
              </button>
            )}
          </div>
        </div>

        <div className="sd-row sd-wrap sd-gap8">
          <span className="sd-chip sd-chip--soft">📅 {fmtDate(order.scheduled_date)}</span>
          <span className="sd-chip sd-chip--soft">⏰ {formatScheduledSlot(order.scheduled_slot)}</span>
          {order.cans_count != null && order.cans_count > 0 && (
            <span className="sd-chip sd-chip--ok">💧 {order.cans_count} can{order.cans_count > 1 ? 's' : ''}</span>
          )}
        </div>

        {order.status !== 'cancelled' && (
          <div className="sd-row sd-wrap sd-gap8">
            {isOverdue && <span className="sd-chip sd-chip--bad">⚠ Overdue</span>}
            {isToday && <span className="sd-chip sd-chip--warn">● Today</span>}
            {isPaid ? (
              <span className="sd-chip sd-chip--ok">✓ Paid · {payMethod}</span>
            ) : (
              <span className="sd-chip sd-chip--warn">💵 Collect {INR(order.amount)} · {payMethod}</span>
            )}
          </div>
        )}

        {canRevealContact && (hasPhone || fullAddress) && (
          <div className="sd-row sd-gap8">
            {hasPhone && (
              <a href={`tel:${cleanPhone(order.customer_phone)}`} className="sd-quick" aria-label={`Call ${order.customer_name}`}>
                📞 Call
              </a>
            )}
            {hasPhone && (
              <a
                href={waLink(order.customer_phone, `Hello ${order.customer_name}, this is your AuroTap water supplier about order #${order.booking_id.slice(0, 8).toUpperCase()}${order.scheduled_slot ? ` (${order.scheduled_slot})` : ''}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="sd-quick"
                aria-label={`WhatsApp ${order.customer_name}`}
              >
                💬 WhatsApp
              </a>
            )}
            {fullAddress && (
              <a href={mapsLink(fullAddress)} target="_blank" rel="noopener noreferrer" className="sd-quick" aria-label="Navigate to delivery address">
                🧭 Navigate
              </a>
            )}
          </div>
        )}

        {order.notes && <p className="sd-note">{order.notes}</p>}

        {isAssignedAndWaiting && (
          <button type="button" disabled={isUpdating} onClick={() => onAccept(order.id)} className="sd-btn sd-btn--info sd-btn--block">
            {isUpdating ? 'Confirming…' : 'Accept Order'}
          </button>
        )}

        {next && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => next === 'delivered' ? onRequestComplete(order) : onUpdateStatus(order.id, next)}
            className="sd-btn sd-btn--primary sd-btn--block"
          >
            {isUpdating ? (
              <svg className="sd-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7 1.5A5.5 5.5 0 0 0 1.5 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              Icon.check(14)
            )}
            {isUpdating ? 'Updating…' : nextLabel[order.status]}
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SupplierDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stock, setStock] = useState<SupplierStockState | null>(null);
  const [stockDelta, setStockDelta] = useState('');
  const [lowStockInput, setLowStockInput] = useState('');
  const [bufferInput, setBufferInput] = useState('');
  const [stockBusy, setStockBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [dispatchOnline, setDispatchOnline] = useState(false);
  const [dispatchSettingsBusy, setDispatchSettingsBusy] = useState(false);

  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [showNotifs, setShowNotifs] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersStale, setOrdersStale] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [earningsSummary, setEarningsSummary] = useState<{ period: string; order_count: number; gross_amount: number; pending_payout: number } | null>(null);
  const [ratingLoadState, setRatingLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [completionOrder, setCompletionOrder] = useState<Order | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentCollector, setPaymentCollector] = useState<'supplier' | 'aurotap'>('supplier');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OrderFilter>('all');
  // Tracks which "assigned, not yet accepted" orders we've already seen,
  // so a genuinely new assignment can trigger an instant alert.
  const knownWaitingRef = useRef<Set<string> | null>(null);


  // ── Auth guard + safe session recovery ───────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    let active = true;
    let initialized = false;
    let refreshInFlight = false;
    const redirectToLogin = () => { if (active) router.replace('/auth/login?redirect=/supplier/dashboard'); };

    const initialize = async () => {
      try {
        let result = await supabase.auth.getSession();
        if (result.error) {
          await new Promise((resolve) => setTimeout(resolve, 900));
          result = await supabase.auth.getSession();
        }
        if (!active) return;
        if (result.error) {
          console.error('[supplier] session check failed:', result.error.message);
          toast.error('Could not verify your session. Check your connection and retry.');
          return;
        }
        if (!result.data.session?.user) {
          // Browser storage can briefly lag during Supabase token rotation. Attempt one
          // explicit refresh before redirecting, so a recoverable session is not lost.
          const refreshed = await supabase.auth.refreshSession();
          if (!active) return;
          if (refreshed.error || !refreshed.data.session?.user) {
            redirectToLogin();
            return;
          }
          await loadAll(refreshed.data.session.user.id);
          return;
        }
        await loadAll(result.data.session.user.id);
      } catch (error) {
        console.error('[supplier] session initialization failed:', error instanceof Error ? error.message : error);
        if (active) toast.error('Could not verify your session. Please retry without closing the page.');
      } finally { initialized = true; }
    };
    void initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && initialized && event === 'SIGNED_OUT' && !session) redirectToLogin();
    });

    const refreshOnFocus = () => {
      if (!active || !initialized || document.visibilityState !== 'visible' || !navigator.onLine || refreshInFlight) return;
      refreshInFlight = true;
      void (async () => {
        try {
          const result = await supabase.auth.getSession();
          if (result.error) { console.warn('[supplier] focus session check failed:', result.error.message); return; }
          if (!result.data.session?.user) {
            // A missing session on tab focus can be a brief storage/refresh race; verify once more.
            await new Promise((resolve) => setTimeout(resolve, 900));
            const retry = await supabase.auth.getSession();
            if (retry.error) {
              console.warn('[supplier] retry session check failed:', retry.error.message);
              return;
            }
            if (!retry.data.session?.user) {
              const refreshed = await supabase.auth.refreshSession();
              if (refreshed.error || !refreshed.data.session?.user) { redirectToLogin(); return; }
              await loadAll(refreshed.data.session.user.id);
              return;
            }
            await loadAll(retry.data.session.user.id);
            return;
          }
          await loadAll(result.data.session.user.id);
        } catch (error) {
          console.error('[supplier] focus refresh failed:', error instanceof Error ? error.message : error);
        } finally { refreshInFlight = false; }
      })();
    };
    const online = () => { setNetworkOnline(true); refreshOnFocus(); };
    const offline = () => setNetworkOnline(false);
    setNetworkOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load all data ───────────────────────────────────────────────────────────
  const loadAll = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProfile(userId),
        fetchNotifications(userId),
        fetchStock(),
        fetchDispatchSettings(),
      ]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async (userId: string) => {
    // The production schema stores supplier identity in public.profiles.
    // Do not query the legacy supplier_profiles table (it is not deployed).
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, city, is_active, status, role')
      .eq('id', userId)
      .eq('role', 'supplier')
      .maybeSingle();

    if (error || !data) {
      console.error('[supplier] profile load failed:', error?.message ?? 'Supplier profile not found');
      toast.error('Could not load your supplier account. Please contact support if your account was recently approved.');
      return;
    }

    const normalized: SupplierProfile = {
      id: data.id,
      user_id: data.id,
      full_name: data.full_name ?? 'Supplier',
      phone: data.phone ?? '',
      city: data.city ?? '',
      tier: 'bronze',
      is_active: data.is_active === true && data.status === 'active',
      is_verified: data.status === 'active',
      total_deliveries: 0,
      total_earnings: 0,
      rating: 0,
      rating_count: 0,
      created_at: new Date().toISOString(),
    };

    setRatingLoadState('loading');
    setProfile(normalized);
    await Promise.all([
      fetchOrders(),
      fetchEarnings(normalized.id),
      (async () => {
        try {
          const rating = await supplierRatingGet();
          setProfile((current) => current?.id === normalized.id ? { ...current, rating: rating.average_rating, rating_count: rating.review_count } : current);
          setRatingLoadState('loaded');
        } catch (ratingError) {
          setRatingLoadState('error');
          console.warn('[supplier] rating unavailable:', ratingError instanceof Error ? ratingError.message : ratingError);
        }
      })(),
    ]);
    buildStats(normalized);
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);

    try {
      // Use the role-protected API instead of querying legacy "customers"
      // relations and columns that are not part of the current profiles/orders schema.
      // One quiet retry: a single gateway hiccup (502/503) should not blank the screen.
      let rows: Awaited<ReturnType<typeof supplierOrdersList>>;
      try {
        rows = await supplierOrdersList();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        rows = await supplierOrdersList();
      }
      setOrdersStale(false);
      const flat: Order[] = rows.map((row) => {
        const noteText = String(row.note ?? row.notes ?? '');
        const slotMatch = noteText.match(/(?:^|\|\s*)Slot:\s*([^|]+)/i);
        const scheduledValue = row.scheduled_date ?? row.scheduled_at ?? row.scheduled_time ?? '';
        const scheduledDate = toISTDateKey(scheduledValue);

        return {
          id: String(row.id ?? ''),
          booking_id: String(row.order_number ?? row.booking_id ?? row.id ?? ''),
          service_type: String(row.service_type_label ?? row.service_type ?? row.service_type_key ?? row.service_type_id ?? 'Service'),
          status: normalizeOrderStatus(row.status),
          amount: Number(row.final_amount ?? row.total_amount ?? row.amount ?? 0),
          cans_count: row.can_count == null && row.can_quantity == null && row.cans_count == null
            ? null
            : Number(row.can_count ?? row.can_quantity ?? row.cans_count),
          scheduled_date: scheduledDate,
          scheduled_slot: String(row.time_slot ?? row.scheduled_slot ?? slotMatch?.[1]?.trim() ?? ''),
          notes: row.note ?? row.notes ?? null,
          created_at: String(row.created_at ?? ''),
          accepted_at: row.accepted_at ?? null,
          payment_method: row.payment_method ?? null,
          payment_status: row.payment_status ?? null,
          address_line: String(row.address_text ?? ''),
          city: '',
          customer_name: String(row.customer_name ?? '—'),
          customer_phone: String(row.customer_phone ?? '—'),
        };
      });

      setOrders(flat);

      const waiting = flat.filter((o) => o.status === 'assigned' && !o.accepted_at).map((o) => o.id);
      if (knownWaitingRef.current === null) {
        knownWaitingRef.current = new Set(waiting);
      } else {
        const known = knownWaitingRef.current;
        const fresh = waiting.filter((id) => !known.has(id));
        if (fresh.length > 0) {
          toast.success(
            fresh.length === 1 ? 'New order assigned to you' : `${fresh.length} new orders assigned to you`,
            { description: 'Open Active Orders to accept.' },
          );
          try { navigator.vibrate?.(200); } catch { /* not supported */ }
        }
        knownWaitingRef.current = new Set(waiting);
      }
    } catch (error) {
      console.error('[supplier] orders load failed:', error);
      // Keep whatever we already showed; just flag it as possibly out of date.
      setOrdersStale(true);
      const raw = error instanceof Error ? error.message : '';
      const friendly = /50[0-4]|bad gateway|unavailable|timeout|fetch/i.test(raw) || !raw
        ? 'Server is busy. Showing your last loaded orders, retrying automatically.'
        : raw;
      toast.error(friendly, { id: 'orders-load-error' });
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchEarnings = async (supplierId: string) => {
    // Earnings are derived from the canonical orders table in production.
    // Do not query the legacy supplier_earnings table (it is not deployed).
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[supplier] earnings load failed:', error.message);
      setEarnings([]);
      return;
    }

    try {
      const summary = await supplierEarningsSummary('month');
      setEarningsSummary(summary);
    } catch (summaryError) {
      setEarningsSummary(null);
      console.warn('[supplier] earnings summary unavailable:', summaryError instanceof Error ? summaryError.message : summaryError);
    }
    // Filter status on the client: an enum filter with an unknown label makes PostgREST answer 400.
    const doneRows = (data ?? []).filter((row) =>
      ['completed', 'delivered'].includes(String(row.status ?? '').toLowerCase()),
    );
    setEarnings(doneRows.slice(0, 50).map((row) => {
      const amount = Number(row.supplier_payout ?? 0);
      const payoutStatus = String(row.payout_status ?? 'pending').toLowerCase();
      const paidAt = typeof row.payout_paid_at === 'string' ? row.payout_paid_at : null;
      // A positive supplier_payout is not sufficient proof of posting. The immutable ledger-posted
      // timestamp is the accounting source of truth; legacy/unreconciled rows remain review-only.
      const financialsPosted = Boolean(row.financials_posted_at);
      const needsReview = !financialsPosted || !Number.isFinite(amount) || amount <= 0;
      const isSettled = payoutStatus === 'paid' && !needsReview;
      return {
        id: String(row.id),
        order_id: String(row.id),
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        status: needsReview ? 'review' as const : isSettled ? 'paid' as const : 'pending' as const,
        paid_at: isSettled ? paidAt : null,
        created_at: String(row.completed_at ?? row.created_at ?? ''),
      };
    }));
  };

  const fetchDispatchSettings = async () => {
    try {
      const data = await supplierSettingsGet();
      setDispatchOnline(Boolean(data?.is_online));
    } catch (error) {
      console.error('[supplier] dispatch settings load failed:', error);
    }
  };

  const toggleDispatchAvailability = async () => {
    if (dispatchSettingsBusy) return;
    setDispatchSettingsBusy(true);
    try {
      const data = await supplierSettingsUpdate({ is_online: !dispatchOnline });
      setDispatchOnline(Boolean(data.is_online));
      toast.success(data.is_online ? 'You are now available for nearby orders.' : 'You are offline for new orders.');
    } catch (error) {
      console.error('[supplier] dispatch availability update failed:', error);
      toast.error('Could not update order availability.');
    } finally {
      setDispatchSettingsBusy(false);
    }
  };

  const fetchStock = async () => {
    try {
      const data = await supplierStockGet();
      setStock(data);
      setLowStockInput(data ? String(data.low_stock_alert) : '');
      setBufferInput(data ? String(data.reservation_buffer_cans) : '');
    } catch (error) {
      console.error('[supplier] stock load failed:', error);
      setStock(null);
    }
  };

  const adjustStock = async (delta: number) => {
    if (!Number.isInteger(delta) || delta === 0 || stockBusy) return;
    setStockBusy(true);
    try {
      const data = await supplierStockUpdate({ stock_delta: delta });
      setStock(data);
      setStockDelta('');
      toast.success(delta < 0 ? 'Offline sale recorded.' : 'Stock added.');
    } catch (error) {
      console.error('[supplier] stock update failed:', error);
      toast.error('Stock could not be updated. Reserved stock is protected.');
    } finally {
      setStockBusy(false);
    }
  };

  const updateStockControls = async (patch: {
    low_stock_alert?: number;
    reservation_buffer_cans?: number;
  }) => {
    if (!stock || stockBusy) return;
    setStockBusy(true);
    try {
      const data = await supplierStockUpdate({
        cans_available: stock.cans_available,
        ...patch,
      });
      setStock(data);
      toast.success('Inventory controls updated.');
    } catch (error) {
      console.error('[supplier] stock controls update failed:', error);
      toast.error('Inventory controls could not be saved.');
    } finally {
      setStockBusy(false);
    }
  };

  const syncDispatchLocation = async () => {
    if (locationBusy || typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Location is not available in this browser.');
      return;
    }

    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const token = await supabase.auth.getSession();
          if (!token.data.session) {
            toast.error('Your session has expired.');
            return;
          }

          const response = await fetch('/api/supplier/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token.data.session.access_token}`,
            },
            body: JSON.stringify({
              base_lat: position.coords.latitude,
              base_lng: position.coords.longitude,
            }),
          });

          if (!response.ok) {
            throw new Error('Location update failed');
          }

          toast.success('Dispatch location updated.');
        } catch (error) {
          console.error('[supplier] dispatch location update failed:', error);
          toast.error('Could not update dispatch location.');
        } finally {
          setLocationBusy(false);
        }
      },
      (error) => {
        console.error('[supplier] geolocation failed:', error);
        toast.error('Please allow location access to improve nearby order matching.');
        setLocationBusy(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const fetchNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[supplier] notifications load failed:', error);
      setNotifications([]);
      return;
    }

    setNotifications((data as Notification[]) ?? []);
  };

  const buildStats = (p: SupplierProfile) => {
    // Will be recalculated from real orders after fetchOrders resolves
    // Starting with profile-stored aggregates
    setStats({
      todayOrders: 0,
      pendingOrders: 0,
      weekEarnings: 0,
      monthEarnings: 0,
      completionRate: 0,
      avgRating: p.rating,
    });
  };

  // Recalculate stats from live order data
  useEffect(() => {
    if (!profile) return;
    const today = todayIST();
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

    const todayOrders = orders.filter((o) => o.scheduled_date === today).length;
    const pendingOrders = orders.filter((o) =>
      ['pending', 'assigned', 'in_progress'].includes(o.status)
    ).length;

    const weekEarnings = earnings
      .filter((e) => e.status !== 'review' && e.created_at >= weekAgo)
      .reduce((sum, e) => sum + e.amount, 0);

    const monthEarnings = earnings
      .filter((e) => e.status !== 'review' && e.created_at >= monthAgo)
      .reduce((sum, e) => sum + e.amount, 0);

    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const completionRate =
      orders.length > 0 ? Math.round((delivered / orders.length) * 100) : 0;

    setStats({
      todayOrders,
      pendingOrders,
      weekEarnings,
      monthEarnings,
      completionRate,
      avgRating: profile.rating,
    });
  }, [orders, earnings, profile]);

  // ── Realtime (debounced, polls only when websocket is down) ─────────────────
  const { status: realtimeStatus } = useSupplierRealtime({
    supplierId: profile?.id,
    onOrdersChange: async () => {
      if (!profile?.id) return;
      await Promise.all([fetchOrders(), fetchEarnings(profile.id)]);
    },
    onNotification: (row) => {
      const notif = row as unknown as Notification;
      setNotifications((prev) => [notif, ...prev.slice(0, 19)]);
      toast.info(notif.title, { description: notif.body });
    },
  });


  // ── Protected supplier workflow actions ─────────────────────────────────────
  const handleAcceptOrder = useCallback(async (orderId: string) => {
    setUpdatingOrder(orderId);
    try {
      await supplierOrderAccept(orderId);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, accepted_at: new Date().toISOString() }
            : o
        )
      );
      toast.success('Order accepted. You can now start delivery.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to accept this order.');
      if (profile?.id) await fetchOrders();
    } finally {
      setUpdatingOrder(null);
    }
  }, [profile?.id]);

  const handleUpdateStatus = useCallback(
    async (
      orderId: string,
      newStatus: OrderStatus,
      payment?: {
        payment_confirmed?: boolean;
        payment_reference?: string;
        payment_collector?: 'supplier' | 'aurotap';
      },
    ): Promise<boolean> => {
      setUpdatingOrder(orderId);

      try {
        const apiStatus =
          newStatus === 'delivered' ? 'COMPLETED' : 'IN_PROGRESS';

        await supplierOrderUpdateStatus(orderId, apiStatus, payment);

        const nextStatus =
          newStatus === 'delivered' ? 'delivered' : newStatus;

        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: nextStatus,
                  ...(nextStatus === 'delivered'
                    ? { payment_status: 'paid' }
                    : {}),
                }
              : o,
          ),
        );

        toast.success(
          nextStatus === 'delivered'
            ? 'Order completed and payment recorded.'
            : `Order moved to ${STATUS_META[nextStatus].label}.`,
        );

        if (profile?.id) {
          // Completion changes supplier_payout/payout_status atomically in the database.
          // Refresh earnings immediately as well as orders; realtime delivery is not guaranteed.
          await Promise.all([
            fetchOrders(),
            ...(nextStatus === 'delivered' ? [fetchEarnings(profile.id)] : []),
          ]);
        }

        return true;
      } catch (error) {
        console.error('[supplier] update status failed:', error);

        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to update order status.',
        );

        return false;
      } finally {
        setUpdatingOrder(null);
      }
    },
    [profile?.id],
  );

  // ── Sign out ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      toast.success('Signed out successfully.');
      router.push('/auth/login');
    } catch (error) {
      console.error('[supplier] sign out failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'Unable to sign out.',
      );
    } finally {
      setSigningOut(false);
    }
  };

  // ── Mark notifications read ─────────────────────────────────────────────────
  const markNotifsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    if (error) {
      console.error('[supplier] notification read update failed:', error);
      toast.error('Unable to mark notifications as read.');
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true })),
    );
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeOrders = useMemo(
    () => orders.filter((o) => ['pending', 'assigned', 'in_progress'].includes(o.status)),
    [orders]
  );
  const historyOrders = useMemo(
    () => orders.filter((o) => ['delivered', 'cancelled'].includes(o.status)),
    [orders]
  );
  const q = query.trim().toLowerCase();
  const todayStr = todayIST();

  const filteredActive = useMemo(
    () =>
      activeOrders
        .filter((o) => {
          if (!matchesQuery(o, q)) return false;
          if (filter === 'today') return o.scheduled_date === todayStr;
          if (filter === 'tomorrow') return o.scheduled_date === tomorrowIST();
          if (filter === 'overdue') return !!o.scheduled_date && o.scheduled_date < todayStr;
          if (filter === 'cash') return o.payment_status !== 'paid';
          if (filter === 'accept') return o.status === 'assigned' && !o.accepted_at;
          return true;
        })
        .sort((a, b) =>
          (a.scheduled_date || '9999').localeCompare(b.scheduled_date || '9999') ||
          a.scheduled_slot.localeCompare(b.scheduled_slot) ||
          a.created_at.localeCompare(b.created_at),
        ),
    [activeOrders, q, filter, todayStr],
  );
  const filteredHistory = useMemo(
    () => historyOrders.filter((o) => matchesQuery(o, q)),
    [historyOrders, q],
  );
  const displayOrders = tab === 'active' ? filteredActive : filteredHistory;
  const hasFilter = q !== '' || (tab === 'active' && filter !== 'all');

  const route = useMemo(() => {
    const todays = activeOrders.filter((o) => o.scheduled_date === todayStr);
    const slots = new Map<string, number>();
    todays.forEach((o) => {
      const key = o.scheduled_slot || 'Anytime';
      slots.set(key, (slots.get(key) ?? 0) + 1);
    });
    return {
      todays: todays.length,
      overdue: activeOrders.filter((o) => o.scheduled_date && o.scheduled_date < todayStr).length,
      cans: todays.reduce((sum, o) => sum + (o.cans_count ?? 0), 0),
      cash: todays.reduce((sum, o) => sum + (o.payment_status === 'paid' ? 0 : o.amount), 0),
      awaiting: activeOrders.filter((o) => o.status === 'assigned' && !o.accepted_at).length,
      slots: Array.from(slots.entries()),
    };
  }, [activeOrders, todayStr]);

  const freeCans = stock ? Math.max(0, stock.cans_available - stock.reserved_cans) : 0;
  const lowStock = !!stock && freeCans <= stock.low_stock_alert;
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const deliveredCount = useMemo(() => orders.filter((o) => o.status === 'delivered').length, [orders]);
  const deliveries = Math.max(profile?.total_deliveries ?? 0, deliveredCount);
  const earnedTotal = Math.max(profile?.total_earnings ?? 0, earnings.filter((e) => e.status !== 'review').reduce((sum, e) => sum + e.amount, 0));
  const derivedTier: SupplierProfile['tier'] =
    deliveries >= 400 ? 'platinum' : deliveries >= 150 ? 'gold' : deliveries >= 50 ? 'silver' : 'bronze';
  const effectiveTier: SupplierProfile['tier'] =
    TIER_RANK.indexOf(derivedTier) > TIER_RANK.indexOf(profile?.tier ?? 'bronze')
      ? derivedTier
      : profile?.tier ?? 'bronze';
  const tier = profile ? TIER_META[effectiveTier] : null;
  const tierProgress =
    profile && tier
      ? Math.min(100, Math.round((deliveries / tier.target) * 100))
      : 0;

  // Live count in the browser tab title, e.g. "(3) Supplier Dashboard"
  useEffect(() => {
    const n = activeOrders.length;
    document.title = n > 0 ? `(${n}) Supplier Dashboard | AuroTap` : 'Supplier Dashboard | AuroTap';
  }, [activeOrders.length]);

  const reloadAll = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadAll(session.user.id);
  };


  if (!mounted) return null;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{DASHBOARD_CSS}</style>

      <div className="sdash">
        {!networkOnline && (
          <div role="status" aria-live="polite" style={{ position: 'sticky', top: 0, zIndex: 80, padding: '10px 16px', background: '#7F1D1D', color: '#FEF2F2', fontSize: 12, fontWeight: 800, textAlign: 'center' }}>
            You are offline. Dashboard data may be out of date; it will refresh when connection returns.
          </div>
        )}
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="sd-header">
          <div className="sd-header-in">
            <div className="sd-row" style={{ gap: 10, minWidth: 0 }}>
              <div className="sd-logo">{Icon.drop(19, '#fff')}</div>
              <div>
                <div className="sd-brand">AuroTap</div>
                <div className="sd-brand-sub sd-sub">Supplier Portal</div>
              </div>
            </div>

            <div className="sd-row" style={{ gap: 10, flexShrink: 0 }}>
              <button
                type="button"
                title="Refresh data"
                aria-label="Refresh data"
                className="sd-iconbtn"
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session?.user) await loadAll(session.user.id);
                  toast.success('Dashboard refreshed.');
                }}
              >
                {Icon.refresh(15)}
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={showNotifs}
                  className="sd-iconbtn"
                  onClick={() => { setShowNotifs((v) => !v); if (!showNotifs) markNotifsRead(); }}
                >
                  {Icon.bell(16)}
                  {unreadCount > 0 && <span className="sd-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>

                {showNotifs && (
                  <div className="sd-notif">
                    <div className="sd-notif-head">
                      Notifications
                      <span style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 600 }}>{notifications.length} total</span>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>No notifications yet</div>
                      ) : notifications.map((n) => (
                        <div key={n.id} className={`sd-notif-item${n.is_read ? '' : ' unread'}`}>
                          <b>
                            {!n.is_read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block', flexShrink: 0 }} />}
                            {n.title}
                          </b>
                          <p>{n.body}</p>
                          <time>{fmtTime(n.created_at)}</time>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {loading ? (
                <Skeleton w={110} h={38} r={12} />
              ) : (
                <div className="sd-pill">
                  <div className="sd-avatar" style={{ background: `linear-gradient(145deg,${tier?.color ?? '#0B8A60'},${tier?.color ?? '#08694B'}cc)` }}>
                    {profile?.full_name?.[0]?.toUpperCase() ?? 'S'}
                  </div>
                  <div className="sd-pill-name">
                    <b>{profile?.full_name?.split(' ')[0] ?? 'Supplier'}</b>
                    <i style={{ color: tier?.color ?? 'var(--brand)' }}>{tier?.label ?? '—'} Tier</i>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={signingOut}
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="sd-iconbtn sd-iconbtn--danger"
              >
                {Icon.logout(15)}
              </button>
            </div>
          </div>
        </header>

        {/* ── MAIN ───────────────────────────────────────────────────────── */}
        <main className="sd-main">
          {!loading && !profile && (
            <div role="alert" className="sd-alert sd-alert--bad" style={{ padding: '20px', display: 'block' }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Supplier account not found</div>
              <p style={{ margin: '6px 0 14px', fontSize: 12, lineHeight: 1.6, fontWeight: 500, color: 'var(--ink2)' }}>
                We could not load your supplier profile. If your account was recently approved, wait a minute and retry, or contact support.
              </p>
              <button type="button" onClick={() => void reloadAll()} className="sd-btn sd-btn--primary">Retry</button>
            </div>
          )}

          {ordersStale && !loading && (
            <div role="status" className="sd-alert sd-alert--warn">
              <span>Live data is delayed. Showing your last loaded orders.</span>
              <button type="button" onClick={() => void fetchOrders()} className="sd-btn sd-btn--soft sd-btn--sm">Retry now</button>
            </div>
          )}

          {/* Hero */}
          <div className="sd-hero">
            <div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
              <div className="sd-eyebrow">
                {loading ? <Skeleton w={120} h={12} /> : `Welcome back${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
              </div>
              <h1 className="sd-h1">{loading ? <Skeleton w={260} h={32} /> : 'Supplier Dashboard'}</h1>
              {!loading && profile && (
                <div className="sd-row sd-wrap sd-gap8" style={{ marginTop: 12 }}>
                  <span className={`sd-chip ${profile.is_active ? 'sd-chip--ok' : 'sd-chip--bad'}`}>
                    {profile.is_active ? '● Active' : '● Inactive'}
                  </span>
                  {profile.is_verified && <span className="sd-chip sd-chip--info">✓ Verified</span>}
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>{profile.city}</span>
                  <button
                    type="button"
                    disabled={dispatchSettingsBusy}
                    onClick={() => void toggleDispatchAvailability()}
                    aria-pressed={dispatchOnline}
                    className="sd-toggle"
                  >
                    {dispatchOnline ? '● Taking orders' : '○ Offline · tap to go online'}
                  </button>
                </div>
              )}
            </div>

            {!loading && profile && tier && (
              <div className="sd-tier">
                <div className="sd-row sd-between">
                  <span style={{ fontSize: 12, fontWeight: 800, color: tier.color }}>🏆 {tier.label} Tier</span>
                  {effectiveTier !== 'platinum' && <span style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 600 }}>Next: {tier.next}</span>}
                </div>
                <div className="sd-track"><div style={{ width: `${tierProgress}%`, background: tier.color }} /></div>
                <div className="sd-row sd-between" style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 600 }}>
                  <span>{deliveries} deliveries</span>
                  {effectiveTier !== 'platinum' && <span>{tier.target} needed</span>}
                </div>
              </div>
            )}
          </div>

          {/* ── STATS GRID ─────────────────────────────────────────────── */}
          <div className="sd-stats">
            <StatCard icon={Icon.truck(17)} label="Today's Orders" value={stats?.todayOrders.toString() ?? '—'} sub="Scheduled for today" accent="#0B8A60" loading={loading} />
            <StatCard icon={Icon.drop(17, '#0277B6')} label="Active Orders" value={stats?.pendingOrders.toString() ?? '—'} sub="Pending + In-progress" accent="#0277B6" loading={loading} />
            <StatCard icon={Icon.wallet(17)} label="This Week" value={stats ? INR(stats.weekEarnings) : '—'} sub="Earnings (7 days)" accent="#6D28D9" loading={loading} />
            <StatCard icon={Icon.chart(17)} label="This Month" value={stats ? INR(stats.monthEarnings) : '—'} sub={`${stats?.completionRate ?? 0}% completion rate`} accent="#9A5A06" loading={loading} />
            <StatCard
              icon={<>{Icon.star(16)}</>}
              label="Your Rating"
              value={!profile || ratingLoadState === 'loading' ? '—' : ratingLoadState === 'error' ? 'Unavailable' : profile.rating_count > 0 ? `${profile.rating.toFixed(1)} ★` : 'No reviews'}
              sub={ratingLoadState === 'error' ? 'Could not verify review data' : profile && profile.rating_count > 0 ? `Based on ${profile.rating_count} customer reviews` : ratingLoadState === 'loaded' ? 'No customer reviews yet' : 'Loading verified review data'}
              accent="#B45309"
              loading={loading}
            />
            <StatCard icon={Icon.truck(17)} label="Total Deliveries" value={profile ? deliveries.toLocaleString('en-IN') : '—'} sub={`${INR(earnedTotal)} earned`} accent="#0B8A60" loading={loading} />
          </div>

          {/* ── TODAY'S ROUTE + ALERTS ─────────────────────────────────── */}
          {!loading && profile && (
            <section aria-label="Today's delivery route" style={{ marginBottom: 28 }}>
              {!dispatchOnline && (
                <div role="status" className="sd-alert sd-alert--warn">
                  <span>You are offline, so new orders will not be offered to you.</span>
                  <button type="button" disabled={dispatchSettingsBusy} onClick={() => void toggleDispatchAvailability()} className="sd-btn sd-btn--primary sd-btn--sm">Go online</button>
                </div>
              )}
              {lowStock && stock && (
                <div role="alert" className="sd-alert sd-alert--bad">
                  ⚠ Low stock: only {freeCans} free can{freeCans === 1 ? '' : 's'} left (alert level {stock.low_stock_alert}). Restock to keep receiving orders.
                </div>
              )}
              <div className="sd-section-label">Today&apos;s route</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
                <MiniStat label="Deliveries today" value={String(route.todays)} tone="var(--ink)" />
                <MiniStat label="Cans to deliver" value={String(route.cans)} tone="#0277B6" />
                <MiniStat label="Cash to collect" value={INR(route.cash)} tone="#9A5A06" />
                <MiniStat label="Needs accept" value={String(route.awaiting)} tone={route.awaiting > 0 ? '#0369A1' : 'var(--ink)'} />
                {route.overdue > 0 && <MiniStat label="Overdue" value={String(route.overdue)} tone="#B91C1C" />}
              </div>
              {route.slots.length > 0 && (
                <div className="sd-row sd-wrap sd-gap8" style={{ marginTop: 14 }}>
                  {route.slots.map(([slot, count]) => (
                    <span key={slot} className="sd-chip sd-chip--soft">⏰ {slot} · {count}</span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── INVENTORY + DISPATCH CONTROLS ─────────────────────────── */}
          <section className="sd-panels">
            <div className="sd-card sd-panel">
              <div className="sd-row sd-between sd-wrap sd-top" style={{ gap: 14 }}>
                <div>
                  <div className="sd-panel-label" style={{ color: 'var(--aqua)' }}>Live inventory</div>
                  <div className="sd-big">{stock ? stock.cans_available.toLocaleString('en-IN') : '—'} cans</div>
                  <div className="sd-help" style={{ marginTop: 4, fontSize: 12 }}>
                    {stock ? `${stock.reserved_cans} reserved · ${Math.max(0, stock.cans_available - stock.reserved_cans)} free before buffer` : 'Loading inventory…'}
                  </div>
                  {stock && stock.cans_available > 0 && (
                    <div aria-hidden="true" className="sd-meter">
                      <div style={{ width: `${Math.min(100, (stock.reserved_cans / stock.cans_available) * 100)}%`, background: '#0EA5E9' }} />
                      <div style={{ flex: 1, background: lowStock ? '#F59E0B' : '#10B981' }} />
                    </div>
                  )}
                </div>
                <div style={{ minWidth: 210, flex: '1 1 210px', maxWidth: 300 }}>
                  <div className="sd-row sd-gap8">
                    <input
                      value={stockDelta}
                      onChange={(e) => setStockDelta(e.target.value.replace(/[^0-9-]/g, ''))}
                      inputMode="numeric"
                      placeholder="Offline sale / restock"
                      aria-label="Stock adjustment quantity"
                      className="sd-input"
                    />
                    <button
                      type="button"
                      disabled={stockBusy || !Number.isInteger(Number(stockDelta)) || Number(stockDelta) === 0}
                      onClick={() => void adjustStock(Number(stockDelta))}
                      className="sd-btn sd-btn--primary"
                    >
                      Adjust
                    </button>
                  </div>
                  <div className="sd-help" style={{ marginTop: 7 }}>Use negative values for offline sales, positive values for restocking.</div>
                </div>
              </div>
              <div className="sd-row sd-wrap sd-gap8" style={{ marginTop: 16 }}>
                <button type="button" disabled={stockBusy} onClick={() => void adjustStock(-1)} className="sd-btn sd-btn--danger sd-btn--sm">−1 offline sale</button>
                <button type="button" disabled={stockBusy} onClick={() => void adjustStock(10)} className="sd-btn sd-btn--info sd-btn--sm">+10 restock</button>
                <span style={{ alignSelf: 'center', fontSize: 11, fontWeight: 600, color: stock && stock.cans_available - stock.reserved_cans <= stock.low_stock_alert ? '#9A5A06' : 'var(--ink3)' }}>
                  Low-stock alert: {stock?.low_stock_alert ?? '—'}
                </span>
                <label className="sd-row sd-gap6 sd-help">
                  Alert
                  <input value={lowStockInput} onChange={(e) => setLowStockInput(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="Low stock alert threshold" className="sd-input sd-input--sm" />
                </label>
                <label className="sd-row sd-gap6 sd-help">
                  Buffer
                  <input value={bufferInput} onChange={(e) => setBufferInput(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="Reservation buffer cans" className="sd-input sd-input--sm" />
                </label>
                <button
                  type="button"
                  disabled={stockBusy || !stock}
                  onClick={() => void updateStockControls({
                    low_stock_alert: Math.max(0, Math.floor(Number(lowStockInput || 0))),
                    reservation_buffer_cans: Math.max(0, Math.floor(Number(bufferInput || 0))),
                  })}
                  className="sd-btn sd-btn--soft sd-btn--sm"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="sd-card sd-panel">
              <div className="sd-panel-label" style={{ color: 'var(--brand2)' }}>Dispatch control</div>
              <div className="sd-row sd-between" style={{ marginTop: 10, gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Accept nearby orders</div>
                  <div className="sd-help" style={{ marginTop: 4 }}>
                    {dispatchOnline ? 'You are visible to dispatch.' : 'You are hidden from new dispatch offers.'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={dispatchSettingsBusy}
                  onClick={() => void toggleDispatchAvailability()}
                  aria-pressed={dispatchOnline}
                  className="sd-toggle"
                  style={{ padding: '9px 16px', fontSize: 12 }}
                >
                  {dispatchSettingsBusy ? '…' : dispatchOnline ? 'Online' : 'Offline'}
                </button>
              </div>
              <div className="sd-help" style={{ marginTop: 12 }}>
                Orders reserve cans atomically. Offline sales cannot reduce inventory below reserved stock.
              </div>
              <button type="button" disabled={locationBusy} onClick={() => void syncDispatchLocation()} className="sd-btn sd-btn--info sd-btn--block" style={{ marginTop: 16 }}>
                {locationBusy ? 'Updating location…' : 'Use current location for dispatch'}
              </button>
            </div>
          </section>

          {/* ── ORDERS SECTION ─────────────────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <div className="sd-row sd-between sd-wrap" style={{ gap: 12, marginBottom: 18 }}>
              <div className="sd-seg" role="tablist" aria-label="Order lists">
                {(['active', 'history'] as const).map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                    {t === 'active' ? 'Active Orders' : 'History'}
                    <span className="sd-count">{t === 'active' ? activeOrders.length : historyOrders.length}</span>
                  </button>
                ))}
              </div>

              <div className="sd-live">
                {tab === 'active' ? (
                  <span role="status" aria-live="polite" className="sd-live">
                    <span className="sd-dot" style={{ background: realtimeStatus === 'live' ? '#10B981' : realtimeStatus === 'connecting' ? '#F59E0B' : '#EF4444', boxShadow: realtimeStatus === 'live' ? '0 0 8px #10B981' : 'none' }} />
                    {realtimeStatus === 'live' ? 'Live · instant updates' : realtimeStatus === 'connecting' ? 'Connecting…' : 'Reconnecting · refreshing every 10s'}
                  </span>
                ) : `${historyOrders.length} completed orders`}
              </div>
            </div>

            <div className="sd-row sd-wrap sd-gap8" style={{ marginBottom: 16 }}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, order ID, area…"
                aria-label="Search orders"
                className="sd-input"
                style={{ flex: '1 1 220px' }}
              />
              {tab === 'active' && (Object.keys(FILTER_LABELS) as OrderFilter[]).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="sd-filter">
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>

            {loadingOrders ? (
              <div className="sd-orders">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="sd-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Skeleton h={16} w="60%" />
                    <Skeleton h={60} />
                    <Skeleton h={12} w="80%" />
                    <Skeleton h={42} r={12} />
                  </div>
                ))}
              </div>
            ) : displayOrders.length === 0 ? (
              <div className="sd-empty">
                <div style={{ fontSize: 38, marginBottom: 12 }}>{tab === 'active' ? '💧' : '📦'}</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                  {hasFilter ? 'No orders match your search' : tab === 'active' ? 'No active orders right now' : 'No order history yet'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
                  {hasFilter
                    ? 'Try a different name, phone number or filter.'
                    : tab === 'active'
                      ? 'New orders will appear here automatically when assigned.'
                      : 'Completed and cancelled orders will show up here.'}
                </div>
                {hasFilter && (
                  <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="sd-btn sd-btn--soft" style={{ marginTop: 16 }}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="sd-orders">
                {displayOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onAccept={handleAcceptOrder}
                    onUpdateStatus={handleUpdateStatus}
                    onRequestComplete={(order) => {
                      setCompletionOrder(order);
                      setPaymentReference('');
                      setPaymentConfirmed(false);
                      setPaymentCollector('supplier');
                    }}
                    updating={updatingOrder}
                  />
                ))}
              </div>
            )}
          </div>

          {completionOrder && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="complete-order-title"
              className="sd-scrim"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !updatingOrder) {
                  setCompletionOrder(null);
                }
              }}
            >
              <div className="sd-modal">
                <div className="sd-row sd-between sd-top" style={{ gap: 16 }}>
                  <div>
                    <div className="sd-eyebrow" style={{ marginBottom: 0 }}>Final delivery step</div>
                    <h2 id="complete-order-title" style={{ margin: '6px 0 0', fontSize: 21, fontWeight: 800 }}>Confirm completion</h2>
                    <p style={{ margin: '7px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--ink2)' }}>
                      Confirm the service is complete and record payment before closing this order.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close completion dialog"
                    disabled={Boolean(updatingOrder)}
                    onClick={() => setCompletionOrder(null)}
                    className="sd-iconbtn"
                    style={{ flexShrink: 0, fontSize: 20 }}
                  >
                    ×
                  </button>
                </div>

                <div className="sd-well" style={{ marginTop: 18, padding: 14, gap: 4 }}>
                  <div className="sd-row sd-between" style={{ gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{completionOrder.service_type}</div>
                      <div className="sd-help" style={{ marginTop: 3 }}>
                        #{completionOrder.booking_id.slice(0, 8).toUpperCase()} · {completionOrder.customer_name}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand2)' }}>{INR(completionOrder.amount)}</div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink2)' }}>
                    Payment method: <strong style={{ color: 'var(--ink)' }}>{completionOrder.payment_method?.toUpperCase() || 'CASH'}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink2)' }}>
                    Payment status: <strong style={{ color: completionOrder.payment_status === 'paid' ? '#047857' : '#9A5A06' }}>
                      {completionOrder.payment_status === 'paid' ? 'Already paid' : 'Confirmation required'}
                    </strong>
                  </div>
                </div>

                {completionOrder.payment_status !== 'paid' && (
                  <>
                    <label>
                      <span className="sd-label">Who collected the payment?</span>
                      <select
                        value={paymentCollector}
                        onChange={(event) => setPaymentCollector(event.target.value === 'aurotap' ? 'aurotap' : 'supplier')}
                        disabled={Boolean(updatingOrder)}
                        className="sd-input"
                        style={{ minHeight: 46 }}
                      >
                        <option value="supplier">Supplier collected directly</option>
                        <option value="aurotap">AuroTap collected</option>
                      </select>
                    </label>
                    {completionOrder.payment_method?.toLowerCase() === 'upi' && (
                      <label>
                        <span className="sd-label">UPI transaction reference</span>
                        <input
                          value={paymentReference}
                          onChange={(event) => setPaymentReference(event.target.value.slice(0, 100))}
                          placeholder="Enter UPI / transaction ID"
                          maxLength={100}
                          disabled={Boolean(updatingOrder)}
                          autoComplete="off"
                          className="sd-input"
                          style={{ minHeight: 46 }}
                        />
                      </label>
                    )}

                    <label className="sd-check" style={{ cursor: updatingOrder ? 'wait' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={paymentConfirmed}
                        onChange={(event) => setPaymentConfirmed(event.target.checked)}
                        disabled={Boolean(updatingOrder)}
                      />
                      <span>I confirm the customer has paid the order amount and the payment details are accurate.</span>
                    </label>
                  </>
                )}

                <div className="sd-row" style={{ gap: 12, marginTop: 22 }}>
                  <button type="button" disabled={Boolean(updatingOrder)} onClick={() => setCompletionOrder(null)} className="sd-btn sd-btn--soft" style={{ flex: 1, minHeight: 48 }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(updatingOrder) || (completionOrder.payment_status !== 'paid' && (!paymentConfirmed || (completionOrder.payment_method?.toLowerCase() === 'upi' && !paymentReference.trim())))}
                    onClick={async () => {
                      const ok = await handleUpdateStatus(
                        completionOrder.id,
                        'delivered',
                        completionOrder.payment_status === 'paid'
                          ? undefined
                          : {
                              payment_confirmed: true,
                              payment_reference: paymentReference.trim() || undefined,
                              payment_collector: paymentCollector,
                            },
                      );

                      if (ok) {
                        setCompletionOrder(null);
                        setPaymentReference('');
                        setPaymentConfirmed(false);
                      }
                    }}
                    className="sd-btn sd-btn--primary"
                    style={{ flex: 1.35, minHeight: 48 }}
                  >
                    {updatingOrder ? 'Completing…' : 'Confirm & Complete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── EARNINGS SUMMARY + TABLE ─────────────────────────────────── */}
          <section aria-label="Supplier earnings" style={{ marginBottom: 24 }}>
            <div className="sd-row sd-between sd-wrap" style={{ gap: 12, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>Earnings summary</h2>
              <button type="button" className="sd-btn sd-btn--soft sd-btn--sm" onClick={() => {
                if (!exportEarningsCsv(earnings)) toast.info('No recent earnings rows available to export yet.');
              }}>
                Export recent CSV ({earnings.length})
              </button>
            </div>
            <div className="sd-stats" style={{ marginBottom: 16 }}>
              <StatCard icon={Icon.wallet(17)} label="This month" value={earningsSummary ? INR(earningsSummary.gross_amount) : '—'} sub={earningsSummary ? `${earningsSummary.order_count} orders counted by finance ledger` : 'Summary temporarily unavailable'} accent="#6D28D9" loading={loading} />
              <StatCard icon={Icon.chart(17)} label="Pending payout" value={earningsSummary ? INR(earningsSummary.pending_payout) : '—'} sub="From the supplier earnings ledger" accent="#9A5A06" loading={loading} />
            </div>
          </section>
          {earnings.length > 0 && (
            <div>
              <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>Recent Earnings (latest 50 loaded rows)</h2>
              <div className="sd-table">
                <div className="sd-earn sd-earn--head">
                  {['Order', 'Amount', 'Status', 'Date'].map((h) => <div key={h}>{h}</div>)}
                </div>
                {earnings.slice(0, 10).map((e) => (
                  <div key={e.id} className="sd-earn">
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>#{e.order_id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: e.status === 'review' ? '#B91C1C' : 'var(--brand2)' }}>{e.amount > 0 ? INR(e.amount) : 'Unverified'}</div>
                    <div>
                      <span className={`sd-chip ${e.status === 'paid' ? 'sd-chip--ok' : e.status === 'review' ? 'sd-chip--bad' : 'sd-chip--warn'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                        {e.status === 'paid' ? 'Paid' : e.status === 'review' ? 'Needs review' : 'Pending'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{e.paid_at ? fmtDate(e.paid_at) : fmtDate(e.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

