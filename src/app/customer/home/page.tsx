// 'use client';

// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import Link from 'next/link';
// import { usePathname, useRouter } from 'next/navigation';
// import { toast } from 'sonner';

// import BottomNav from '@/components/customer/BottomNav';
// import { useAuth } from '@/hooks/useAuth';
// import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';
// import { clearSession } from '@/hooks/useAuth';
// import { getToken } from '@/lib/api-client';

// type CustomerStatsApi = {
//   total_spent: number;
//   cans_ordered: number;
//   member_since: string | null;
// };

// type OrderRow = {
//   id: string;
//   status: string;
//   total_amount: number;
//   created_at: string;
//   can_quantity: number | null;
//   supplier_id: string | null;
// };

// type SupplierLite = {
//   id: string;
//   full_name: string | null;
//   milestone_tier: string | null;
// };

// type NotificationRow = {
//   id: string;
//   title: string | null;
//   body: string | null;
//   created_at: string;
//   is_read: boolean;
//   order_id: string | null;
//   type: string | null;
// };

// const WHATSAPP_SUPPORT = 'https://wa.me/919889305803';

// function inr(n: number): string {
//   return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
// }

// function relTime(iso: string): string {
//   try {
//     const d = Date.now() - new Date(iso).getTime();
//     if (d < 60_000) return 'Just now';
//     if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
//     if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
//     return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
//   } catch {
//     return '';
//   }
// }

// function SkeletonLine({ w, h = 12 }: { w: number | string; h?: number }) {
//   return (
//     <div
//       style={{
//         width: w,
//         height: h,
//         borderRadius: 10,
//         background: 'linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)',
//         backgroundSize: '600px 100%',
//         animation: 'awShimmer 1.4s ease-in-out infinite',
//       }}
//     />
//   );
// }

// function statusStepIndex(status: string): number {
//   const s = status.toUpperCase();
//   if (s === 'PENDING') return 0;
//   if (s === 'ASSIGNED') return 1;
//   if (s === 'IN_PROGRESS') return 2;
//   if (s === 'COMPLETED') return 3;
//   return 0;
// }

// function StatusStepper({ status }: { status: string }) {
//   const idx = statusStepIndex(status);
//   const steps = ['Order Placed', 'Supplier Assigned', 'On the Way', 'Delivered'];
//   return (
//     <div className="mt-3">
//       <div className="flex items-center justify-between gap-2">
//         {steps.map((label, i) => {
//           const done = i <= idx;
//           const active = i === idx;
//           return (
//             <div key={label} className="flex-1">
//               <div className="flex items-center">
//                 <div
//                   className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-extrabold"
//                   style={{
//                     background: done ? '#2563EB' : '#E5E7EB',
//                     color: done ? '#fff' : '#64748B',
//                     boxShadow: active ? '0 0 0 4px rgba(37,99,235,0.12)' : 'none',
//                   }}
//                 >
//                   {done ? '✓' : i + 1}
//                 </div>
//                 {i < steps.length - 1 ? (
//                   <div className="h-[3px] flex-1 mx-2 rounded-full" style={{ background: i < idx ? '#2563EB' : '#E5E7EB' }} />
//                 ) : null}
//               </div>
//               <div className="mt-2 text-[11px] font-semibold" style={{ color: done ? '#1D4ED8' : '#6B7280' }}>
//                 {label}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

// export default function CustomerHomePage() {
//   const router = useRouter();
//   const pathname = usePathname() ?? '/customer/home';
//   const { hydrated, isLoggedIn, isCustomer, name, fullName, session } = useAuth();

//   const [stats, setStats] = useState<CustomerStatsApi | null>(null);
//   const [statsLoading, setStatsLoading] = useState(true);

//   const [orders, setOrders] = useState<OrderRow[]>([]);
//   const [ordersLoading, setOrdersLoading] = useState(true);

//   const [supplier, setSupplier] = useState<SupplierLite | null>(null);

//   const [notifs, setNotifs] = useState<NotificationRow[]>([]);
//   const [notifsLoading, setNotifsLoading] = useState(true);
//   const [notifOpen, setNotifOpen] = useState(false);

//   const [founding, setFounding] = useState<boolean>(false);

//   const bellRef = useRef<HTMLButtonElement | null>(null);

//   const activeOrder = useMemo(() => {
//     const active = orders.find((o) => ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(o.status.toUpperCase()));
//     return active ?? null;
//   }, [orders]);

//   const greeting = useMemo(() => {
//     const h = new Date().getHours();
//     return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
//   }, []);

//   const firstName = name ?? (fullName?.split(/\s+/)[0] ?? 'there');

//   const ensureAuthed = useCallback(() => {
//     if (!hydrated) return false;
//     if (!isLoggedIn || !isCustomer) {
//       router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//       return false;
//     }
//     return true;
//   }, [hydrated, isLoggedIn, isCustomer, router, pathname]);

//   const authHeaders = useCallback(async (): Promise<HeadersInit | null> => {
//     if (!ensureAuthed()) return null;
//     const token = await getToken();
//     if (!token) {
//       clearSession();
//       router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//       return null;
//     }
//     return { Authorization: `Bearer ${token}` };
//   }, [ensureAuthed, router, pathname]);

//   const loadStats = useCallback(async () => {
//     setStatsLoading(true);
//     try {
//       const headers = await authHeaders();
//       if (!headers) return;
//       const res = await fetch('/api/customer/stats', { credentials: 'include', headers });
//       if (res.status === 401) {
//         clearSession();
//         router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }
//       const json = (await res.json()) as { success?: boolean; data?: CustomerStatsApi; error?: string };
//       if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load stats');
//       setStats(json.data ?? { total_spent: 0, cans_ordered: 0, member_since: null });
//     } catch (e: unknown) {
//       const msg = e instanceof Error ? e.message : 'Could not load stats';
//       toast.error(msg);
//       setStats({ total_spent: 0, cans_ordered: 0, member_since: null });
//     } finally {
//       setStatsLoading(false);
//     }
//   }, [authHeaders, router, pathname]);

//   const loadOrders = useCallback(async () => {
//     setOrdersLoading(true);
//     try {
//       const headers = await authHeaders();
//       if (!headers) return;
//       const res = await fetch('/api/customer/orders?limit=20&offset=0', { credentials: 'include', headers });
//       if (res.status === 401) {
//         clearSession();
//         router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }
//       const json = (await res.json()) as { success?: boolean; data?: unknown; error?: string };
//       if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load orders');
//       const rows = Array.isArray(json.data) ? json.data : [];
//       setOrders(
//         rows.map((r): OrderRow => {
//           const rr = r as Record<string, unknown>;
//           return {
//             id: String(rr.id ?? ''),
//             status: String(rr.status ?? ''),
//             total_amount: Number(rr.total_amount ?? 0),
//             created_at: String(rr.created_at ?? new Date().toISOString()),
//             can_quantity: rr.can_quantity == null ? null : Number(rr.can_quantity),
//             supplier_id: rr.supplier_id == null ? null : String(rr.supplier_id),
//           };
//         })
//       );
//     } catch (e: unknown) {
//       toast.error(e instanceof Error ? e.message : 'Could not load orders');
//       setOrders([]);
//     } finally {
//       setOrdersLoading(false);
//     }
//   }, [authHeaders, router, pathname]);

//   const loadNotifs = useCallback(async () => {
//     setNotifsLoading(true);
//     try {
//       const headers = await authHeaders();
//       if (!headers) return;
//       const res = await fetch('/api/customer/notifications?limit=5', { credentials: 'include', headers });
//       if (res.status === 401) {
//         clearSession();
//         router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }
//       const json = (await res.json()) as { success?: boolean; data?: unknown; error?: string };
//       if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load notifications');
//       const rows = Array.isArray(json.data) ? json.data : [];
//       setNotifs(
//         rows.map((r): NotificationRow => {
//           const rr = r as Record<string, unknown>;
//           return {
//             id: String(rr.id ?? ''),
//             title: rr.title == null ? null : String(rr.title),
//             body: rr.body == null ? (rr.message == null ? null : String(rr.message)) : String(rr.body),
//             created_at: String(rr.created_at ?? new Date().toISOString()),
//             is_read: Boolean(rr.is_read),
//             order_id: rr.order_id == null ? null : String(rr.order_id),
//             type: rr.type == null ? null : String(rr.type),
//           };
//         })
//       );
//     } catch (e: unknown) {
//       toast.error(e instanceof Error ? e.message : 'Could not load notifications');
//       setNotifs([]);
//     } finally {
//       setNotifsLoading(false);
//     }
//   }, [authHeaders, router, pathname]);

//   const markAllRead = useCallback(async () => {
//     try {
//       const headers = await authHeaders();
//       if (!headers) return;
//       const res = await fetch('/api/customer/notifications/read-all', { method: 'PUT', credentials: 'include', headers });
//       if (res.status === 401) {
//         clearSession();
//         router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }
//       setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
//     } catch (e: unknown) {
//       console.error('markAllRead failed', e);
//       toast.error(e instanceof Error ? e.message : 'Server error — please try again');
//     }
//   }, [authHeaders, router, pathname]);

//   useEffect(() => {
//     void loadStats();
//     void loadOrders();
//     void loadNotifs();
//     // Intentionally run once on mount to avoid dependency loops.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // Realtime notifications subscription
//   useEffect(() => {
//     if (!session?.accessToken || !session.userId) return;
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;
//     const channel = sb
//       .channel(`notifs_${session.userId}`)
//       .on(
//         'postgres_changes',
//         { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.userId}` },
//         () => {
//           void loadNotifs();
//         }
//       )
//       .subscribe();
//     return () => {
//       void sb.removeChannel(channel);
//     };
//   }, [session?.accessToken, session?.userId, loadNotifs]);

//   // Founding member flag (first 100 customers)
//   useEffect(() => {
//     if (!session?.accessToken || !session.userId) return;
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;
//     let cancelled = false;
//     void (async () => {
//       const { data: me } = await sb.from('profiles').select('created_at, role').eq('id', session.userId).maybeSingle();
//       if (!me?.created_at || String(me.role ?? '') !== 'customer') return;
//       const createdAt = String(me.created_at);
//       const { count } = await sb
//         .from('profiles')
//         .select('id', { count: 'exact', head: true })
//         .eq('role', 'customer')
//         .lte('created_at', createdAt);
//       if (!cancelled) setFounding((count ?? 0) <= 100);
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, [session?.accessToken, session?.userId]);

//   // Active order supplier badge (name + tier, no phone/address)
//   useEffect(() => {
//     const sid = activeOrder?.supplier_id ?? null;
//     if (!sid || !session?.accessToken) {
//       setSupplier(null);
//       return;
//     }
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;
//     let cancelled = false;
//     void sb
//       .from('profiles')
//       .select('id, full_name, milestone_tier')
//       .eq('id', sid)
//       .maybeSingle()
//       .then(({ data }) => {
//         if (!cancelled && data) {
//           setSupplier({
//             id: String((data as { id?: string }).id ?? sid),
//             full_name: (data as { full_name?: string | null }).full_name ?? null,
//             milestone_tier: (data as { milestone_tier?: string | null }).milestone_tier ?? null,
//           });
//         }
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, [activeOrder?.supplier_id, session?.accessToken]);

//   const unreadCount = notifs.filter((n) => !n.is_read).length;

//   const recentOrders = useMemo(() => {
//     return orders.filter((o) => o.status.toUpperCase() === 'COMPLETED').slice(0, 3);
//   }, [orders]);

//   const daysWith = useMemo(() => {
//     if (!stats?.member_since) return 0;
//     const ms = Date.now() - new Date(stats.member_since).getTime();
//     return Math.max(0, Math.floor(ms / 86_400_000));
//   }, [stats?.member_since]);

//   if (!hydrated) {
//     return <div className="min-h-screen bg-white" />;
//   }

//   return (
//     <div className="min-h-screen bg-white pb-20">
//       <style>{`
//         @keyframes awShimmer { 0%{background-position:-300px 0} 100%{background-position:300px 0} }
//       `}</style>

//       <div className="mx-auto w-full" style={{ maxWidth: 430 }}>
//         {/* [A] Greeting header */}
//         <div style={{ padding: '20px 16px 16px', background: '#fff' }}>
//           <div className="flex items-start justify-between gap-3">
//             <div className="min-w-0">
//               <div className="aw-heading" style={{ fontSize: 26, fontWeight: 800, color: '#0A1628', lineHeight: 1.15 }}>
//                 {greeting}, {firstName} 👋
//               </div>
//               <div style={{ marginTop: 6, fontSize: 14, color: '#6B7280' }}>
//                 Gorakhpur&apos;s trusted water delivery
//               </div>
//             </div>

//             <div className="relative">
//               <button
//                 ref={bellRef}
//                 type="button"
//                 className="aw-touch"
//                 onClick={() => {
//                   const next = !notifOpen;
//                   setNotifOpen(next);
//                   if (next) {
//                     void markAllRead();
//                   }
//                 }}
//                 style={{
//                   width: 44,
//                   height: 44,
//                   borderRadius: 14,
//                   border: '1px solid #E5E7EB',
//                   background: '#fff',
//                   display: 'flex',
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                   position: 'relative',
//                 }}
//                 aria-label="Notifications"
//               >
//                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//                   <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" />
//                   <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" />
//                 </svg>
//                 {unreadCount > 0 ? (
//                   <span
//                     aria-hidden="true"
//                     style={{
//                       position: 'absolute',
//                       top: 10,
//                       right: 10,
//                       width: 8,
//                       height: 8,
//                       borderRadius: 999,
//                       background: '#EF4444',
//                       boxShadow: '0 0 0 2px #fff',
//                     }}
//                   />
//                 ) : null}
//               </button>

//               {notifOpen ? (
//                 <div
//                   className="aw-card"
//                   style={{
//                     position: 'absolute',
//                     right: 0,
//                     top: 52,
//                     width: 320,
//                     maxWidth: 'calc(100vw - 24px)',
//                     padding: 14,
//                     zIndex: 30,
//                   }}
//                 >
//                   <div className="flex items-center justify-between gap-3">
//                     <div className="font-extrabold" style={{ color: '#0A1628' }}>
//                       Notifications
//                     </div>
//                     <button
//                       type="button"
//                       className="text-sm font-bold"
//                       onClick={() => void markAllRead()}
//                       style={{ color: '#2563EB', background: 'transparent', border: 'none', cursor: 'pointer' }}
//                     >
//                       Mark all read
//                     </button>
//                   </div>

//                   <div className="mt-3">
//                     {notifsLoading ? (
//                       <div className="space-y-3">
//                         <SkeletonLine w="70%" />
//                         <SkeletonLine w="90%" />
//                         <SkeletonLine w="60%" />
//                       </div>
//                     ) : notifs.length === 0 ? (
//                       <div className="text-sm" style={{ color: '#6B7280' }}>
//                         No notifications yet — place an order to get updates
//                       </div>
//                     ) : (
//                       <div className="space-y-3">
//                         {notifs.slice(0, 5).map((n) => (
//                           <button
//                             key={n.id}
//                             type="button"
//                             onClick={() => {
//                               setNotifOpen(false);
//                               if (n.order_id) router.push(`/customer/track/${n.order_id}`);
//                             }}
//                             style={{
//                               width: '100%',
//                               textAlign: 'left',
//                               border: '1px solid #E5E7EB',
//                               borderRadius: 14,
//                               padding: 12,
//                               background: '#fff',
//                               cursor: n.order_id ? 'pointer' : 'default',
//                             }}
//                           >
//                             <div className="flex items-start gap-10 justify-between">
//                               <div className="min-w-0">
//                                 <div className="font-bold" style={{ color: '#0A1628' }}>
//                                   {n.title ?? 'Update'}
//                                 </div>
//                                 <div className="text-sm mt-1" style={{ color: '#6B7280' }}>
//                                   {n.body ?? ''}
//                                 </div>
//                               </div>
//                               <div className="text-xs font-semibold" style={{ color: '#94A3B8', flexShrink: 0 }}>
//                                 {relTime(n.created_at)}
//                               </div>
//                             </div>
//                           </button>
//                         ))}
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               ) : null}
//             </div>
//           </div>
//         </div>

//         {/* [B] Active order card */}
//         {!ordersLoading && activeOrder ? (
//           <div
//             className="aw-card"
//             style={{
//               margin: '0 16px',
//               borderRadius: 16,
//               background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
//               border: '1px solid #BFDBFE',
//             }}
//           >
//             <div style={{ fontSize: 15, fontWeight: 800, color: '#0A1628' }}>
//               Your order is on the way 🚚
//             </div>
//             <StatusStepper status={activeOrder.status} />
//             {supplier?.full_name ? (
//               <div className="mt-3 flex items-center gap-2 flex-wrap">
//                 <div className="text-sm font-bold" style={{ color: '#0A1628' }}>
//                   {supplier.full_name}
//                 </div>
//                 {supplier.milestone_tier ? (
//                   <span
//                     style={{
//                       fontSize: 11,
//                       fontWeight: 900,
//                       padding: '4px 10px',
//                       borderRadius: 999,
//                       background: '#FFFFFF',
//                       border: '1px solid #BFDBFE',
//                       color: '#1D4ED8',
//                       textTransform: 'uppercase',
//                       letterSpacing: '0.04em',
//                     }}
//                   >
//                     {supplier.milestone_tier}
//                   </span>
//                 ) : null}
//               </div>
//             ) : null}
//             <div className="mt-3 flex items-center justify-between gap-3">
//               <div className="text-sm font-semibold" style={{ color: '#1D4ED8' }}>
//                 Expected in ~25 mins
//               </div>
//               <button
//                 type="button"
//                 className="aw-touch"
//                 onClick={() => router.push(`/customer/track/${activeOrder.id}`)}
//                 style={{
//                   padding: '10px 14px',
//                   borderRadius: 14,
//                   background: '#2563EB',
//                   color: '#fff',
//                   fontWeight: 800,
//                   border: 'none',
//                   cursor: 'pointer',
//                 }}
//               >
//                 Track Live →
//               </button>
//             </div>
//           </div>
//         ) : null}

//         {/* [C] Quick order CTA */}
//         {!ordersLoading && !activeOrder ? (
//           <button
//             type="button"
//             onClick={() => router.push('/book')}
//             className="aw-touch"
//             style={{
//               margin: '12px 16px 0',
//               width: 'calc(100% - 32px)',
//               height: 60,
//               borderRadius: 16,
//               background: 'linear-gradient(135deg, #2563EB, #0EA5E9)',
//               boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
//               border: 'none',
//               color: '#fff',
//               textAlign: 'left',
//               padding: '10px 16px',
//               cursor: 'pointer',
//             }}
//           >
//             <div style={{ fontSize: 18, fontWeight: 800 }}>🚚 Order Water Now</div>
//             <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>₹12/can • Free delivery • 45 min</div>
//           </button>
//         ) : null}

//         {/* [G] Founding member banner */}
//         {founding ? (
//           <div
//             className="aw-card"
//             style={{
//               margin: '12px 16px 0',
//               borderRadius: 16,
//               background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)',
//               border: '1px solid #F59E0B',
//             }}
//           >
//             <div className="font-extrabold" style={{ color: '#92400E' }}>
//               ⭐ Founding Member — 10% off every order
//             </div>
//           </div>
//         ) : null}

//         {/* [D] Stats row */}
//         <div className="grid grid-cols-3 gap-3" style={{ padding: '12px 16px 0' }}>
//           {statsLoading ? (
//             <>
//               <div className="aw-card" style={{ borderRadius: 12, padding: 12 }}>
//                 <SkeletonLine w="60%" h={18} />
//                 <div style={{ height: 6 }} />
//                 <SkeletonLine w="80%" />
//               </div>
//               <div className="aw-card" style={{ borderRadius: 12, padding: 12 }}>
//                 <SkeletonLine w="70%" h={18} />
//                 <div style={{ height: 6 }} />
//                 <SkeletonLine w="60%" />
//               </div>
//               <div className="aw-card" style={{ borderRadius: 12, padding: 12 }}>
//                 <SkeletonLine w="55%" h={18} />
//                 <div style={{ height: 6 }} />
//                 <SkeletonLine w="70%" />
//               </div>
//             </>
//           ) : (
//             <>
//               <div className="aw-card" style={{ borderRadius: 12, padding: 12, border: '1px solid #F3F4F6' }}>
//                 <div className="stat-number" style={{ fontSize: 22, fontWeight: 800, color: '#0A1628' }}>
//                   {Math.max(0, stats?.cans_ordered ?? 0)}
//                 </div>
//                 <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginTop: 2 }}>Cans Ordered</div>
//               </div>
//               <div className="aw-card" style={{ borderRadius: 12, padding: 12, border: '1px solid #F3F4F6' }}>
//                 <div className="stat-number" style={{ fontSize: 22, fontWeight: 800, color: '#0A1628' }}>
//                   {inr(stats?.total_spent ?? 0)}
//                 </div>
//                 <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginTop: 2 }}>Total Spent</div>
//               </div>
//               <div className="aw-card" style={{ borderRadius: 12, padding: 12, border: '1px solid #F3F4F6' }}>
//                 <div className="stat-number" style={{ fontSize: 22, fontWeight: 800, color: '#0A1628' }}>
//                   {daysWith} days
//                 </div>
//                 <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginTop: 2 }}>With AuroWater</div>
//               </div>
//             </>
//           )}
//         </div>

//         {/* [E] Recent orders */}
//         <div style={{ padding: '14px 16px 0' }}>
//           <div className="flex items-center justify-between">
//             <div className="font-extrabold" style={{ color: '#0A1628' }}>
//               Recent Orders
//             </div>
//             <Link href="/customer/history" className="text-sm font-bold" style={{ color: '#2563EB', textDecoration: 'none' }}>
//               See all →
//             </Link>
//           </div>

//           <div className="mt-3 space-y-10">
//             {ordersLoading ? (
//               <div className="aw-card">
//                 <SkeletonLine w="65%" />
//                 <div style={{ height: 8 }} />
//                 <SkeletonLine w="45%" />
//               </div>
//             ) : recentOrders.length === 0 ? (
//               <div className="aw-card text-center" style={{ padding: 18 }}>
//                 <div style={{ fontSize: 36 }}>💧</div>
//                 <div className="mt-2 font-extrabold" style={{ color: '#0A1628' }}>
//                   No orders yet
//                 </div>
//                 <div className="mt-1 text-sm" style={{ color: '#6B7280' }}>
//                   Place your first order to see updates here.
//                 </div>
//                 <button
//                   type="button"
//                   className="aw-touch"
//                   onClick={() => router.push('/book')}
//                   style={{
//                     marginTop: 12,
//                     width: '100%',
//                     borderRadius: 16,
//                     padding: '12px 16px',
//                     background: 'linear-gradient(135deg, #2563EB, #0EA5E9)',
//                     color: '#fff',
//                     fontWeight: 800,
//                     border: 'none',
//                     cursor: 'pointer',
//                   }}
//                 >
//                   Place your first order →
//                 </button>
//               </div>
//             ) : (
//               recentOrders.map((o) => {
//                 const cans = Math.max(1, Number(o.can_quantity ?? 1));
//                 const date = new Date(o.created_at);
//                 const status = o.status.toUpperCase();
//                 const pill =
//                   status === 'COMPLETED'
//                     ? { bg: '#ECFDF5', text: '#065F46' }
//                     : status === 'CANCELLED'
//                       ? { bg: '#FEF2F2', text: '#B91C1C' }
//                       : { bg: '#EFF6FF', text: '#1D4ED8' };
//                 return (
//                   <div key={o.id} className="aw-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
//                     <div style={{ fontSize: 22 }}>💧</div>
//                     <div style={{ flex: 1, minWidth: 0 }}>
//                       <div className="aw-heading" style={{ fontSize: 16, fontWeight: 800, color: '#0A1628' }}>
//                         {cans} cans
//                       </div>
//                       <div className="mt-1 flex items-center gap-2 flex-wrap">
//                         <div className="text-sm" style={{ color: '#6B7280' }}>
//                           {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
//                         </div>
//                         <span style={{ width: 4, height: 4, borderRadius: 999, background: '#CBD5E1' }} />
//                         <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: pill.bg, color: pill.text }}>
//                           {status.replace(/_/g, ' ')}
//                         </span>
//                       </div>
//                     </div>
//                     <div style={{ textAlign: 'right' }}>
//                       <div className="aw-heading price-display" style={{ fontSize: 16, fontWeight: 800, color: '#0A1628' }}>
//                         {inr(o.total_amount)}
//                       </div>
//                       <button
//                         type="button"
//                         className="aw-touch"
//                         onClick={() => router.push(`/book?cans=${encodeURIComponent(String(cans))}`)}
//                         style={{
//                           marginTop: 6,
//                           borderRadius: 12,
//                           padding: '8px 10px',
//                           border: '1px solid #BFDBFE',
//                           background: '#fff',
//                           color: '#2563EB',
//                           fontWeight: 800,
//                           fontSize: 12,
//                           cursor: 'pointer',
//                         }}
//                       >
//                         Reorder
//                       </button>
//                     </div>
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* [F] Quick actions */}
//         <div style={{ padding: '14px 16px 14px' }}>
//           <div className="grid grid-cols-2 gap-3">
//             <QuickAction href="/customer/addresses" icon="📍" label="My Addresses" />
//             <QuickAction href="/customer/history" icon="📋" label="Order History" />
//             <QuickAction href="/pricing" icon="💧" label="View Pricing" />
//             <QuickAction href={WHATSAPP_SUPPORT} icon="💬" label="Get Support" external />
//           </div>
//         </div>
//       </div>

//       <BottomNav activeOrderId={activeOrder?.id ?? null} />
//     </div>
//   );
// }

// function QuickAction({
//   href,
//   icon,
//   label,
//   external,
// }: {
//   href: string;
//   icon: string;
//   label: string;
//   external?: boolean;
// }) {
//   const body = (
//     <div className="aw-card" style={{ borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
//       <div className="flex items-center gap-10" style={{ gap: 10 }}>
//         <div style={{ fontSize: 18 }}>{icon}</div>
//         <div className="font-extrabold" style={{ color: '#0A1628' }}>
//           {label}
//         </div>
//       </div>
//       <div style={{ color: '#94A3B8', fontWeight: 900 }}>›</div>
//     </div>
//   );

//   if (external) {
//     return (
//       <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
//         {body}
//       </a>
//     );
//   }
//   return (
//     <Link href={href} style={{ textDecoration: 'none' }}>
//       {body}
//     </Link>
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
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import BottomNav from '@/components/customer/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';
import { clearSession } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

type CustomerStatsApi = {
  total_spent: number;
  cans_ordered: number;
  member_since: string | null;
};

type OrderRow = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  can_quantity: number | null;
  supplier_id: string | null;
};

type SupplierLite = {
  id: string;
  full_name: string | null;
  milestone_tier: string | null;
};

type NotificationRow = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
  is_read: boolean;
  order_id: string | null;
  type: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const WHATSAPP_SUPPORT = 'https://wa.me/919889305803';

const STATUS_ORDER = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const;
const STATUS_LABELS = ['Order Placed', 'Supplier Assigned', 'On the Way', 'Delivered'];

// ─── Utilities ───────────────────────────────────────────────────────────────

function inr(n: number): string {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

function relTime(iso: string): string {
  try {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000) return 'Just now';
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function statusStepIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status.toUpperCase() as (typeof STATUS_ORDER)[number]);
  return idx >= 0 ? idx : 0;
}

function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonLine({ w, h = 12 }: { w: number | string; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        background: 'linear-gradient(90deg,#EEF2FF 25%,#E0E7FF 50%,#EEF2FF 75%)',
        backgroundSize: '600px 100%',
        animation: 'aw-shimmer 1.6s ease-in-out infinite',
      }}
    />
  );
}

function StatSkeleton() {
  return (
    <div style={{ borderRadius: 16, padding: 16, background: '#F8FAFC', border: '1px solid #E8EDFF' }}>
      <SkeletonLine w="55%" h={22} />
      <div style={{ height: 6 }} />
      <SkeletonLine w="75%" h={10} />
    </div>
  );
}

// ─── Status Stepper ──────────────────────────────────────────────────────────

function StatusStepper({ status }: { status: string }) {
  const idx = statusStepIndex(status);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {STATUS_LABELS.map((label, i) => {
          const done = i <= idx;
          const active = i === idx;
          return (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                {i > 0 && (
                  <div
                    style={{
                      height: 3,
                      flex: 1,
                      background: i <= idx ? 'linear-gradient(90deg,#2563EB,#0EA5E9)' : '#E5E7EB',
                      borderRadius: 4,
                      transition: 'background 0.5s ease',
                    }}
                  />
                )}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 900,
                    flexShrink: 0,
                    background: done
                      ? 'linear-gradient(135deg,#2563EB,#0EA5E9)'
                      : '#F1F5F9',
                    color: done ? '#fff' : '#9CA3AF',
                    boxShadow: active ? '0 0 0 4px rgba(37,99,235,0.18), 0 0 12px rgba(37,99,235,0.25)' : 'none',
                    transition: 'all 0.4s ease',
                    transform: active ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {i < STATUS_LABELS.length - 1 && (
                  <div
                    style={{
                      height: 3,
                      flex: 1,
                      background: i < idx ? 'linear-gradient(90deg,#0EA5E9,#2563EB)' : '#E5E7EB',
                      borderRadius: 4,
                      transition: 'background 0.5s ease',
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: done ? 800 : 600,
                  color: done ? '#1D4ED8' : '#9CA3AF',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  transition: 'color 0.3s ease',
                  maxWidth: 58,
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

function QuickAction({
  href,
  icon,
  label,
  external,
  color = '#EFF6FF',
  iconColor = '#2563EB',
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
  color?: string;
  iconColor?: string;
}) {
  const [pressed, setPressed] = useState(false);

  const body = (
    <div
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        borderRadius: 16,
        padding: '14px 16px',
        background: '#fff',
        border: '1.5px solid #E8EDFF',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        boxShadow: pressed ? 'none' : '0 2px 8px rgba(37,99,235,0.06)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
          flexShrink: 0,
          fontSize: 18,
        }}
      >
        {icon}
      </div>
      <div style={{ fontWeight: 800, color: '#0A1628', fontSize: 14, flex: 1 }}>{label}</div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 3l5 5-5 5" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      {body}
    </Link>
  );
}

// ─── Notification Dropdown ────────────────────────────────────────────────────

function NotificationDropdown({
  notifs,
  loading,
  onClose,
  onMarkAllRead,
  onNavigate,
}: {
  notifs: NotificationRow[];
  loading: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onNavigate: (orderId: string | null) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 54,
        width: 330,
        maxWidth: 'calc(100vw - 24px)',
        background: '#fff',
        borderRadius: 20,
        border: '1.5px solid #E8EDFF',
        boxShadow: '0 20px 60px rgba(37,99,235,0.15), 0 4px 16px rgba(0,0,0,0.08)',
        zIndex: 50,
        overflow: 'hidden',
        animation: 'aw-dropdown 0.2s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #F1F5F9',
          background: 'linear-gradient(135deg, #F8FAFF, #EFF6FF)',
        }}
      >
        <div style={{ fontWeight: 900, color: '#0A1628', fontSize: 15 }}>🔔 Notifications</div>
        <button
          type="button"
          onClick={onMarkAllRead}
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#2563EB',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 8,
          }}
        >
          Mark all read
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 12, maxHeight: 320, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map((k) => (
              <div key={k} style={{ padding: 12, borderRadius: 12, background: '#F8FAFF' }}>
                <SkeletonLine w="65%" h={13} />
                <div style={{ height: 6 }} />
                <SkeletonLine w="90%" h={10} />
              </div>
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32 }}>🔕</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6B7280', fontWeight: 600 }}>No notifications yet</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Place an order to get updates here</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifs.slice(0, 6).map((n, i) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate(n.order_id);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: n.is_read ? '1px solid #F1F5F9' : '1.5px solid #BFDBFE',
                  borderRadius: 14,
                  padding: 12,
                  background: n.is_read ? '#FAFBFF' : '#EFF6FF',
                  cursor: n.order_id ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  animation: `aw-fadein 0.3s ease ${i * 0.05}s both`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    {!n.is_read && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#2563EB',
                          marginRight: 6,
                          verticalAlign: 'middle',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span style={{ fontWeight: 800, color: '#0A1628', fontSize: 13 }}>{n.title ?? 'Update'}</span>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 1.4 }}>{n.body ?? ''}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0, fontWeight: 600, paddingTop: 2 }}>
                    {relTime(n.created_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Order Status Pill ────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  const config =
    s === 'COMPLETED'
      ? { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' }
      : s === 'CANCELLED'
        ? { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' }
        : { bg: '#EFF6FF', text: '#1D4ED8', dot: '#2563EB' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 800,
        padding: '4px 10px',
        borderRadius: 999,
        background: config.bg,
        color: config.text,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: config.dot, flexShrink: 0 }} />
      {s.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomerHomePage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/home';
  const { hydrated, isLoggedIn, isCustomer, name, fullName, session } = useAuth();

  const [stats, setStats] = useState<CustomerStatsApi | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierLite | null>(null);
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [founding, setFounding] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);

  // ── Animate in on mount ──
  useEffect(() => {
    const t = setTimeout(() => setPageVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // ── Close notification dropdown on outside click ──
  useEffect(() => {
    if (!notifOpen) return;
    function handle(e: MouseEvent | TouchEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [notifOpen]);

  // ── Derived ──

  const activeOrder = useMemo(
    () => orders.find((o) => ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(o.status.toUpperCase())) ?? null,
    [orders]
  );

  const recentOrders = useMemo(
    () => orders.filter((o) => o.status.toUpperCase() === 'COMPLETED').slice(0, 3),
    [orders]
  );

  const unreadCount = useMemo(() => notifs.filter((n) => !n.is_read).length, [notifs]);

  const daysWith = useMemo(() => {
    if (!stats?.member_since) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(stats.member_since).getTime()) / 86_400_000));
  }, [stats?.member_since]);

  const greeting = useMemo(getGreeting, []);
  const firstName = name ?? (fullName?.split(/\s+/)[0] ?? 'there');

  // ── Auth helpers ──

  const ensureAuthed = useCallback((): boolean => {
    if (!hydrated) return false;
    if (!isLoggedIn || !isCustomer) {
      // BUG FIX: replace() instead of push() to prevent going back to login loop
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
      return false;
    }
    return true;
  }, [hydrated, isLoggedIn, isCustomer, router, pathname]);

  const authHeaders = useCallback(async (): Promise<HeadersInit | null> => {
    if (!ensureAuthed()) return null;
    const token = await getToken();
    if (!token) {
      clearSession();
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
      return null;
    }
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [ensureAuthed, router, pathname]);

  // ── Data loaders ──

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch('/api/customer/stats', { credentials: 'include', headers });
      if (res.status === 401) {
        clearSession();
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const json = (await res.json()) as { success?: boolean; data?: CustomerStatsApi; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load stats');
      setStats(json.data ?? { total_spent: 0, cans_ordered: 0, member_since: null });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load stats');
      setStats({ total_spent: 0, cans_ordered: 0, member_since: null });
    } finally {
      setStatsLoading(false);
    }
  }, [authHeaders, router, pathname]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch('/api/customer/orders?limit=20&offset=0', { credentials: 'include', headers });
      if (res.status === 401) {
        clearSession();
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const json = (await res.json()) as { success?: boolean; data?: unknown; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load orders');
      const rows = Array.isArray(json.data) ? json.data : [];
      setOrders(
        rows.map((r): OrderRow => {
          const rr = r as Record<string, unknown>;
          return {
            id: String(rr.id ?? ''),
            status: String(rr.status ?? 'PENDING'),
            total_amount: Number(rr.total_amount ?? 0),
            created_at: String(rr.created_at ?? new Date().toISOString()),
            can_quantity: rr.can_quantity == null ? null : Number(rr.can_quantity),
            supplier_id: rr.supplier_id == null ? null : String(rr.supplier_id),
          };
        })
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load orders');
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [authHeaders, router, pathname]);

  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch('/api/customer/notifications?limit=6', { credentials: 'include', headers });
      if (res.status === 401) {
        clearSession();
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const json = (await res.json()) as { success?: boolean; data?: unknown; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load notifications');
      const rows = Array.isArray(json.data) ? json.data : [];
      setNotifs(
        rows.map((r): NotificationRow => {
          const rr = r as Record<string, unknown>;
          return {
            id: String(rr.id ?? ''),
            title: rr.title == null ? null : String(rr.title),
            body: rr.body == null ? (rr.message == null ? null : String(rr.message)) : String(rr.body),
            created_at: String(rr.created_at ?? new Date().toISOString()),
            is_read: Boolean(rr.is_read),
            order_id: rr.order_id == null ? null : String(rr.order_id),
            type: rr.type == null ? null : String(rr.type),
          };
        })
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load notifications');
      setNotifs([]);
    } finally {
      setNotifsLoading(false);
    }
  }, [authHeaders, router, pathname]);

  const markAllRead = useCallback(async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch('/api/customer/notifications/read-all', {
        method: 'PUT',
        credentials: 'include',
        headers,
      });
      if (res.status === 401) {
        clearSession();
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e: unknown) {
      console.error('markAllRead failed', e);
    }
  }, [authHeaders, router, pathname]);

  // ── Effects ──

  // BUG FIX: Redirect on mount if not authenticated (prevents silent re-render loops)
  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn || !isCustomer) {
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isLoggedIn, isCustomer, router, pathname]);

  // Load data once auth is confirmed
  useEffect(() => {
    if (!hydrated || !isLoggedIn || !isCustomer) return;
    void loadStats();
    void loadOrders();
    void loadNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isLoggedIn, isCustomer]);

  // Realtime notifications
  useEffect(() => {
    if (!session?.accessToken || !session.userId) return;
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    const channel = sb
      .channel(`notifs_${session.userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.userId}` },
        () => void loadNotifs()
      )
      .subscribe();
    return () => void sb.removeChannel(channel);
  }, [session?.accessToken, session?.userId, loadNotifs]);

  // Founding member
  useEffect(() => {
    if (!session?.accessToken || !session.userId) return;
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      const { data: me } = await sb
        .from('profiles')
        .select('created_at, role')
        .eq('id', session.userId)
        .maybeSingle();
      if (!me?.created_at || String(me.role ?? '') !== 'customer') return;
      const { count } = await sb
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .lte('created_at', String(me.created_at));
      if (!cancelled) setFounding((count ?? 0) <= 100);
    })();
    return () => { cancelled = true; };
  }, [session?.accessToken, session?.userId]);

  // Supplier for active order
  useEffect(() => {
    const sid = activeOrder?.supplier_id ?? null;
    if (!sid || !session?.accessToken) {
      setSupplier(null);
      return;
    }
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let cancelled = false;
    void sb
      .from('profiles')
      .select('id, full_name, milestone_tier')
      .eq('id', sid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          const d = data as { id?: string; full_name?: string | null; milestone_tier?: string | null };
          setSupplier({ id: String(d.id ?? sid), full_name: d.full_name ?? null, milestone_tier: d.milestone_tier ?? null });
        }
      });
    return () => { cancelled = true; };
  }, [activeOrder?.supplier_id, session?.accessToken]);

  // ── Loading state ──

  if (!hydrated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #EFF6FF 0%, #F8FAFF 60%, #fff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '3px solid #BFDBFE',
              borderTopColor: '#2563EB',
              animation: 'aw-spin 0.8s linear infinite',
              margin: '0 auto',
            }}
          />
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: '#6B7280' }}>Loading AuroWater…</div>
        </div>
        <style>{`@keyframes aw-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── BUG FIX: Don't render home content for unauthenticated users ──
  if (!isLoggedIn || !isCustomer) {
    return null;
  }

  // ── Render ──

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #EFF6FF 0%, #F8FAFF 50%, #fff 100%)',
        paddingBottom: 90,
        opacity: pageVisible ? 1 : 0,
        transform: pageVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      <style>{`
        @keyframes aw-shimmer {
          0% { background-position: -300px 0 }
          100% { background-position: 300px 0 }
        }
        @keyframes aw-dropdown {
          from { opacity: 0; transform: translateY(-8px) scale(0.97) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes aw-fadein {
          from { opacity: 0; transform: translateY(6px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes aw-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.6 }
          50% { transform: scale(1.5); opacity: 0 }
        }
        @keyframes aw-bounce-in {
          0% { transform: scale(0.85); opacity: 0 }
          60% { transform: scale(1.04) }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes aw-spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .aw-card-hover { transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }
        .aw-card-hover:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(37,99,235,0.1) !important; }
        .aw-card-hover:active { transform: scale(0.98); }
      `}</style>

      <div style={{ maxWidth: 430, margin: '0 auto', width: '100%' }}>

        {/* ═══════════════════════════════════════════════════════
            [A] HEADER — Greeting + Notification Bell
        ═══════════════════════════════════════════════════════ */}
        <div
          style={{
            padding: '20px 16px 16px',
            background: 'transparent',
            animation: 'aw-fadein 0.4s ease 0.05s both',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            {/* Left: greeting */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#2563EB',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 4,
                }}
              >
                AuroWater
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#0A1628',
                  lineHeight: 1.2,
                  letterSpacing: '-0.5px',
                }}
              >
                {greeting}, {firstName} 👋
              </div>
              <div style={{ marginTop: 5, fontSize: 13, color: '#64748B', fontWeight: 500 }}>
                Gorakhpur&apos;s trusted water delivery
              </div>
            </div>

            {/* Right: bell */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                ref={bellRef}
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) void markAllRead();
                }}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  border: '1.5px solid #E8EDFF',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.08)',
                  transition: 'all 0.18s ease',
                }}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"
                    stroke="#1D4ED8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" />
                </svg>

                {/* Unread badge */}
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 9,
                      right: 9,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: '#EF4444',
                      border: '2px solid #fff',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        inset: -2,
                        borderRadius: '50%',
                        border: '2px solid #EF4444',
                        animation: 'aw-pulse-ring 1.6s ease-out infinite',
                      }}
                    />
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notifOpen && (
                <div ref={dropdownRef}>
                  <NotificationDropdown
                    notifs={notifs}
                    loading={notifsLoading}
                    onClose={() => setNotifOpen(false)}
                    onMarkAllRead={() => void markAllRead()}
                    onNavigate={(orderId) => {
                      if (orderId) router.push(`/customer/track/${orderId}`);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            [B] ACTIVE ORDER CARD
        ═══════════════════════════════════════════════════════ */}
        {!ordersLoading && activeOrder && (
          <div
            style={{
              margin: '0 16px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
              border: '1.5px solid #BFDBFE',
              padding: 18,
              boxShadow: '0 4px 20px rgba(37,99,235,0.12)',
              animation: 'aw-bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            {/* Live pulse indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: '#10B981',
                    animation: 'aw-pulse-ring 1.4s ease-out infinite',
                    opacity: 0.5,
                  }}
                />
                <span
                  style={{ position: 'relative', width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}
                />
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0A1628' }}>Your order is on the way 🚚</span>
            </div>

            <StatusStepper status={activeOrder.status} />

            {/* Supplier badge */}
            {supplier?.full_name && (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#2563EB,#0EA5E9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {supplier.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontWeight: 800, color: '#0A1628', fontSize: 14 }}>{supplier.full_name}</div>
                {supplier.milestone_tier && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: '#FFFFFF',
                      border: '1.5px solid #BFDBFE',
                      color: '#1D4ED8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {supplier.milestone_tier}
                  </span>
                )}
              </div>
            )}

            {/* ETA + Track Button */}
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Estimated arrival</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#1D4ED8' }}>~25 mins ⏱</div>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/customer/track/${activeOrder.id}`)}
                style={{
                  padding: '11px 18px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg,#2563EB,#0EA5E9)',
                  color: '#fff',
                  fontWeight: 900,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                  transition: 'all 0.18s ease',
                  letterSpacing: '-0.2px',
                }}
              >
                Track Live →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            [C] QUICK ORDER CTA (when no active order)
        ═══════════════════════════════════════════════════════ */}
        {!ordersLoading && !activeOrder && (
          <button
            type="button"
            onClick={() => router.push('/book')}
            style={{
              margin: '12px 16px 0',
              width: 'calc(100% - 32px)',
              height: 70,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #1D4ED8, #2563EB, #0EA5E9)',
              backgroundSize: '200% 100%',
              boxShadow: '0 8px 28px rgba(37,99,235,0.38)',
              border: 'none',
              color: '#fff',
              textAlign: 'left',
              padding: '0 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              animation: 'aw-fadein 0.5s ease 0.1s both',
              transition: 'all 0.18s ease',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(37,99,235,0.45)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(37,99,235,0.38)';
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              🚚
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.3px' }}>Order Water Now</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2, fontWeight: 600 }}>
                ₹12/can • Free delivery • 45 min
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 22, opacity: 0.7 }}>→</div>
          </button>
        )}

        {/* ═══════════════════════════════════════════════════════
            [G] FOUNDING MEMBER BANNER
        ═══════════════════════════════════════════════════════ */}
        {founding && (
          <div
            style={{
              margin: '12px 16px 0',
              borderRadius: 16,
              background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
              border: '1.5px solid #F59E0B',
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              animation: 'aw-fadein 0.5s ease 0.2s both',
            }}
          >
            <div style={{ fontSize: 22, flexShrink: 0 }}>⭐</div>
            <div>
              <div style={{ fontWeight: 900, color: '#92400E', fontSize: 14 }}>Founding Member</div>
              <div style={{ fontSize: 12, color: '#B45309', fontWeight: 600, marginTop: 1 }}>
                You get 10% off every order — forever!
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            [D] STATS ROW
        ═══════════════════════════════════════════════════════ */}
        <div
          style={{
            padding: '14px 16px 0',
            animation: 'aw-fadein 0.5s ease 0.15s both',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {statsLoading ? (
              [1, 2, 3].map((k) => <StatSkeleton key={k} />)
            ) : (
              <>
                {[
                  {
                    value: String(Math.max(0, stats?.cans_ordered ?? 0)),
                    label: 'Cans Ordered',
                    icon: '💧',
                    color: '#EFF6FF',
                  },
                  {
                    value: inr(stats?.total_spent ?? 0),
                    label: 'Total Spent',
                    icon: '💳',
                    color: '#F0FDF4',
                  },
                  {
                    value: `${daysWith}d`,
                    label: 'With AuroWater',
                    icon: '📅',
                    color: '#FFF7ED',
                  },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    style={{
                      borderRadius: 16,
                      padding: '13px 12px',
                      background: '#fff',
                      border: '1.5px solid #E8EDFF',
                      boxShadow: '0 2px 8px rgba(37,99,235,0.05)',
                      animation: `aw-fadein 0.4s ease ${0.1 + i * 0.07}s both`,
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 5 }}>{s.icon}</div>
                    <div
                      style={{
                        fontSize: s.value.length > 6 ? 16 : 20,
                        fontWeight: 900,
                        color: '#0A1628',
                        letterSpacing: '-0.5px',
                        lineHeight: 1,
                      }}
                    >
                      {s.value}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#6B7280',
                        marginTop: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            [E] RECENT ORDERS
        ═══════════════════════════════════════════════════════ */}
        <div style={{ padding: '16px 16px 0', animation: 'aw-fadein 0.5s ease 0.2s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 900, color: '#0A1628', fontSize: 16 }}>Recent Orders</div>
            <Link
              href="/customer/history"
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#2563EB',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              See all
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ordersLoading ? (
              [1, 2].map((k) => (
                <div
                  key={k}
                  style={{
                    borderRadius: 16,
                    padding: 16,
                    background: '#fff',
                    border: '1.5px solid #E8EDFF',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <SkeletonLine w={40} h={40} />
                    <div style={{ flex: 1 }}>
                      <SkeletonLine w="55%" h={14} />
                      <div style={{ height: 6 }} />
                      <SkeletonLine w="75%" h={10} />
                    </div>
                  </div>
                </div>
              ))
            ) : recentOrders.length === 0 ? (
              <div
                style={{
                  borderRadius: 20,
                  background: '#fff',
                  border: '1.5px solid #E8EDFF',
                  padding: 28,
                  textAlign: 'center',
                  boxShadow: '0 2px 12px rgba(37,99,235,0.06)',
                }}
              >
                <div style={{ fontSize: 44, marginBottom: 10 }}>💧</div>
                <div style={{ fontWeight: 900, color: '#0A1628', fontSize: 16 }}>No orders yet</div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  Place your first order and enjoy fresh water delivered to your door.
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/book')}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    borderRadius: 14,
                    padding: '13px 16px',
                    background: 'linear-gradient(135deg,#2563EB,#0EA5E9)',
                    color: '#fff',
                    fontWeight: 900,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 15,
                    boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  Place your first order →
                </button>
              </div>
            ) : (
              recentOrders.map((o, i) => {
                const cans = Math.max(1, Number(o.can_quantity ?? 1));
                const date = new Date(o.created_at);
                return (
                  <div
                    key={o.id}
                    className="aw-card-hover"
                    style={{
                      borderRadius: 16,
                      padding: '14px 16px',
                      background: '#fff',
                      border: '1.5px solid #E8EDFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      boxShadow: '0 2px 8px rgba(37,99,235,0.05)',
                      animation: `aw-fadein 0.4s ease ${0.05 * i}s both`,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0,
                      }}
                    >
                      💧
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: '#0A1628', fontSize: 15 }}>{cans} can{cans > 1 ? 's' : ''}</div>
                      <div
                        style={{
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                          {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} />
                        <StatusPill status={o.status} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#0A1628' }}>{inr(o.total_amount)}</div>
                      <button
                        type="button"
                        onClick={() => router.push(`/book?cans=${encodeURIComponent(String(cans))}`)}
                        style={{
                          marginTop: 6,
                          borderRadius: 10,
                          padding: '7px 12px',
                          border: '1.5px solid #BFDBFE',
                          background: '#EFF6FF',
                          color: '#2563EB',
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseOver={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = '#DBEAFE';
                        }}
                        onMouseOut={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF';
                        }}
                      >
                        Reorder
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            [F] QUICK ACTIONS
        ═══════════════════════════════════════════════════════ */}
        <div style={{ padding: '16px 16px 20px', animation: 'aw-fadein 0.5s ease 0.25s both' }}>
          <div style={{ fontWeight: 900, color: '#0A1628', fontSize: 16, marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <QuickAction
              href="/customer/addresses"
              icon="📍"
              label="My Addresses"
              color="#EFF6FF"
              iconColor="#2563EB"
            />
            <QuickAction
              href="/customer/history"
              icon="📋"
              label="Order History"
              color="#F0FDF4"
              iconColor="#059669"
            />
            <QuickAction
              href="/pricing"
              icon="💧"
              label="View Pricing"
              color="#FFF7ED"
              iconColor="#EA580C"
            />
            <QuickAction
              href={WHATSAPP_SUPPORT}
              icon="💬"
              label="Get Support"
              color="#F0FDF4"
              iconColor="#16A34A"
              external
            />
          </div>
        </div>

      </div>

      <BottomNav activeOrderId={activeOrder?.id ?? null} />
    </div>
  );
}