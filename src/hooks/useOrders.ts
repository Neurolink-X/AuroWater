'use client';

/**
 * AuroWater — Orders Hook
 * Place at: src/hooks/useOrders.ts
 *
 * Features:
 *   • NEW service: 'water_can' (RO-purified 20L can supply & subscription)
 *   • Synchronous first render — no loading flicker
 *   • Cross-tab sync via StorageEvent
 *   • Convenience actions: cancelOrder, completeOrder, assignTechnician
 *   • Rich derived stats including avgOrderValue, totalSavings, inProgressOrder
 *   • Filtering + sorting helpers (getByStatus, getByService, sorted)
 *   • bulkAdd, replaceAll, clearAll for seed/test workflows
 *   • Per-order price breakdown utility
 *   • Context provider + useOrdersContext to share one instance
 *   • Zero JSX — valid plain .ts file
 */

import React from 'react';
import { customerOrdersList, getToken, type ApiOrder } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */

export type ServiceKey =
  | 'water_can'       // ← NEW: RO-purified 20L can supply / subscription
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

export type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentMethod = 'cash' | 'online' | 'upi' | 'card';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export type Address = {
  id:        string;
  houseFlat: string;
  area:      string;
  city:      string;
  pincode:   string;
  landmark?: string;
  label?:    string;
  createdAt: number;
  isDefault?: boolean;
};

/** Can-supply-specific metadata — only present when serviceKey === 'water_can' */
export type WaterCanMeta = {
  quantity:       number;   // number of 20L cans ordered
  /** 'one_time' | 'subscription' */
  orderType:      'one_time' | 'subscription';
  /** If subscription, how often (e.g. 'daily' | 'alternate' | 'weekly') */
  frequency?:     'daily' | 'alternate' | 'weekly';
  pricePerCan:    number;
  isBisRo:        boolean;  // BIS-certified RO-purified cans
};

export type StoredOrder = {
  id:             string;
  status:         OrderStatus;
  createdAt:      number;
  updatedAt:      number;
  serviceKey:     ServiceKey;
  subOptionKey:   string;
  address:        Address;
  scheduledDate:  string;
  timeKey:        string;
  emergency:      boolean;
  total:          number;
  paymentMethod:  PaymentMethod;
  paymentStatus:  PaymentStatus;
  technicianName?:  string;
  technicianPhone?: string;
  /** Only present for water_can orders */
  canMeta?:       WaterCanMeta;
  /** Internal note or cancellation reason */
  note?:          string;
};

/** Computed stats derived from the full order list */
export type OrderStats = {
  total:          number;
  active:         number;
  completed:      number;
  cancelled:      number;
  pending:        number;
  inProgress:     number;
  /** Revenue from COMPLETED + paid orders */
  totalSpent:     number;
  /** Average order value across completed orders */
  avgOrderValue:  number;
  /** Estimated savings vs market price (35% premium) */
  totalSavings:   number;
  /** Total water cans ordered across all can orders */
  totalCansOrdered: number;
  /** The single order currently IN_PROGRESS, if any */
  liveOrder:      StoredOrder | null;
};

/** Per-order price breakdown */
export type OrderBreakdown = {
  base:        number;
  convenience: number;
  emergency:   number;
  gst:         number;
  total:       number;
};

/** All filters you can pass to getFiltered() */
export type OrderFilter = {
  status?:    OrderStatus | OrderStatus[];
  service?:   ServiceKey | ServiceKey[];
  from?:      number;   // Unix ms
  to?:        number;   // Unix ms
  paid?:      boolean;
  emergency?: boolean;
  limit?:     number;
};

export type SortKey = 'createdAt' | 'updatedAt' | 'total';
export type SortDir = 'asc' | 'desc';

/** What useOrders returns */
export interface UseOrdersReturn {
  orders:       StoredOrder[];
  loading:      boolean;
  stats:        OrderStats;

  /* ── CRUD ── */
  addOrder:     (order: StoredOrder) => void;
  bulkAdd:      (orders: StoredOrder[]) => void;
  updateOrder:  (id: string, patch: Partial<StoredOrder>) => void;
  removeOrder:  (id: string) => void;

  /* ── Convenience mutations ── */
  cancelOrder:      (id: string, note?: string) => void;
  completeOrder:    (id: string) => void;
  markPaid:         (id: string) => void;
  assignTechnician: (id: string, name: string, phone: string) => void;

  /* ── Queries ── */
  getById:       (id: string) => StoredOrder | undefined;
  getFiltered:   (filter: OrderFilter, sort?: { by?: SortKey; dir?: SortDir }) => StoredOrder[];
  getByStatus:   (status: OrderStatus | OrderStatus[]) => StoredOrder[];
  getByService:  (key: ServiceKey | ServiceKey[]) => StoredOrder[];

  /* ── Dev / seed ── */
  replaceAll: (orders: StoredOrder[]) => void;
  clearAll:   () => void;
}

/* ═══════════════════════════════════════════════════════════════
   SERVICE METADATA  (labels, emoji, descriptions)
═══════════════════════════════════════════════════════════════ */

export const SERVICE_META: Record<
  ServiceKey,
  { label: string; emoji: string; description: string; unit: string }
> = {
  water_can: {
    label:       'Water Can Supply',
    emoji:       '🪣',
    description: 'RO-purified BIS-certified 20L sealed water cans. Pay-as-go or subscription.',
    unit:        'per can',
  },
  water_tanker: {
    label:       'Water Tanker',
    emoji:       '🚛',
    description: 'Bulk water delivery via tanker. Same-day slots available.',
    unit:        'per delivery',
  },
  ro_service: {
    label:       'RO Service & Repair',
    emoji:       '💧',
    description: 'RO purifier service, filter change, AMC, and repair.',
    unit:        'per visit',
  },
  plumbing: {
    label:       'Plumbing',
    emoji:       '🔧',
    description: 'Pipe fitting, leakage repair, tap installation, and drainage.',
    unit:        'per visit',
  },
  borewell: {
    label:       'Borewell Services',
    emoji:       '⛏️',
    description: 'Borewell drilling, repair, and motor fitting.',
    unit:        'per service',
  },
  motor_pump: {
    label:       'Motor & Pump Repair',
    emoji:       '⚙️',
    description: 'Submersible motor repair, rewinding, and pump installation.',
    unit:        'per visit',
  },
  tank_cleaning: {
    label:       'Water Tank Cleaning',
    emoji:       '🪣',
    description: 'Overhead and underground tank cleaning and sanitisation.',
    unit:        'per tank',
  },
};

export const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'];

/* ═══════════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'aw3_orders';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function readFromStorage(): StoredOrder[] {
  if (typeof window === 'undefined') return [];
  const parsed = safeParse<StoredOrder[]>(localStorage.getItem(STORAGE_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

function writeToStorage(orders: StoredOrder[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(orders)); } catch { /* quota */ }
}

function mapApiOrderToStored(o: ApiOrder): StoredOrder {
  const sk = (o.service_type_key ?? 'water_can') as ServiceKey;
  const pay = (o.payment_method ?? 'cash') as PaymentMethod;
  const ps = (o.payment_status ?? 'unpaid') as PaymentStatus;
  const snap = o.address_snapshot;

  return {
    id: o.id,
    status: o.status as OrderStatus,
    createdAt: new Date(o.created_at).getTime(),
    updatedAt: new Date(o.updated_at).getTime(),
    serviceKey: sk,
    subOptionKey: o.can_order_type ?? 'one_time',
    address: {
      id: o.id,
      houseFlat: String(snap?.house_flat ?? ''),
      area: String(snap?.area ?? ''),
      city: String(snap?.city ?? ''),
      pincode: String(snap?.pincode ?? ''),
      landmark: snap?.landmark ? String(snap.landmark) : undefined,
      label: snap?.label ? String(snap.label) : undefined,
      createdAt: Date.now(),
      isDefault: true,
    },
    scheduledDate: o.scheduled_date ?? '',
    timeKey: o.time_slot ?? '',
    emergency: Boolean(o.is_emergency),
    total: Number(o.total_amount ?? 0),
    paymentMethod: pay,
    paymentStatus: ps,
    note: o.notes ?? undefined,
    canMeta:
      sk === 'water_can'
        ? {
            quantity: o.can_quantity ?? 1,
            orderType: (o.can_order_type === 'subscription' ? 'subscription' : 'one_time') as
              | 'one_time'
              | 'subscription',
            frequency: o.can_frequency as WaterCanMeta['frequency'] | undefined,
            pricePerCan: Number(o.can_price_per_unit ?? 0),
            isBisRo: true,
          }
        : undefined,
  };
}

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */

function computeStats(orders: StoredOrder[]): OrderStats {
  const completed  = orders.filter(o => o.status === 'COMPLETED');
  const active     = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const totalSpent = completed
    .filter(o => o.paymentStatus === 'paid')
    .reduce((s, o) => s + (Number(o.total) || 0), 0);

  const totalCansOrdered = orders
    .filter(o => o.serviceKey === 'water_can' && o.canMeta)
    .reduce((s, o) => s + (o.canMeta?.quantity ?? 0), 0);

  return {
    total:            orders.length,
    active:           active.length,
    completed:        completed.length,
    cancelled:        orders.filter(o => o.status === 'CANCELLED').length,
    pending:          orders.filter(o => o.status === 'PENDING').length,
    inProgress:       orders.filter(o => o.status === 'IN_PROGRESS').length,
    totalSpent,
    avgOrderValue:    completed.length > 0 ? Math.round(totalSpent / completed.length) : 0,
    totalSavings:     Math.round(totalSpent * 0.35),   // 35% vs market estimate
    totalCansOrdered,
    liveOrder:        orders.find(o => o.status === 'IN_PROGRESS') ?? null,
  };
}

function applyFilter(
  orders: StoredOrder[],
  filter: OrderFilter,
  sort: { by?: SortKey; dir?: SortDir } = {}
): StoredOrder[] {
  let result = orders;

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    result = result.filter(o => statuses.includes(o.status));
  }
  if (filter.service) {
    const services = Array.isArray(filter.service) ? filter.service : [filter.service];
    result = result.filter(o => services.includes(o.serviceKey));
  }
  if (filter.from   !== undefined) result = result.filter(o => o.createdAt >= filter.from!);
  if (filter.to     !== undefined) result = result.filter(o => o.createdAt <= filter.to!);
  if (filter.paid   !== undefined) result = result.filter(o => (o.paymentStatus === 'paid') === filter.paid);
  if (filter.emergency !== undefined) result = result.filter(o => o.emergency === filter.emergency);

  const by  = sort.by  ?? 'createdAt';
  const dir = sort.dir ?? 'desc';
  result = [...result].sort((a, b) => {
    const av = Number(a[by]) || 0;
    const bv = Number(b[by]) || 0;
    return dir === 'desc' ? bv - av : av - bv;
  });

  if (filter.limit) result = result.slice(0, filter.limit);
  return result;
}

/**
 * Compute a full price breakdown for a single order.
 * Pass settings values for accuracy; sensible defaults are used otherwise.
 */
export function calcOrderBreakdown(
  order: Pick<StoredOrder, 'total' | 'emergency'>,
  opts: { convenienceFee?: number; gstRate?: number; emergencySurcharge?: number } = {}
): OrderBreakdown {
  const conv    = opts.convenienceFee   ?? 29;
  const gstRate = opts.gstRate          ?? 0.18;
  const emgFee  = opts.emergencySurcharge ?? 199;

  const emergency = order.emergency ? emgFee : 0;
  const total     = Math.round(Number(order.total) || 0);

  // Reverse-calculate base from total
  for (let base = 0; base <= 100_000; base++) {
    const gst = Math.round((base + conv) * gstRate);
    if (base + conv + emergency + gst === total) {
      return { base, convenience: conv, emergency, gst, total };
    }
  }

  // Fallback if reverse calculation doesn't converge
  const gst  = Math.round(Math.max(0, total - conv - emergency) * gstRate);
  const base = Math.max(0, total - conv - emergency - gst);
  return { base, convenience: conv, emergency, gst, total };
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */

export function useOrders(): UseOrdersReturn {
  /**
   * Synchronous init — reads localStorage before first render.
   * Eliminates the loading flicker entirely.
   */
  const [orders, setOrders] = React.useState<StoredOrder[]>(() => readFromStorage());
  const [loading, setLoading] = React.useState<boolean>(() => typeof window === 'undefined');

  /* ── Client hydration (SSR → client handoff) ── */
  React.useEffect(() => {
    setOrders(readFromStorage());
    setLoading(false);
  }, []);

  /* ── Sync server orders when Supabase session token is present ── */
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const token = await getToken();
        if (!token) return;
        const rows = await customerOrdersList({ limit: 100, offset: 0 });
        if (cancelled) return;
        const mapped = rows.map(mapApiOrderToStored);
        setOrders(mapped);
        writeToStorage(mapped);
      } catch {
        /* offline / API unavailable — keep local cache */
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Cross-tab sync ── */
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== STORAGE_KEY) return;
      const incoming = safeParse<StoredOrder[]>(e.newValue);
      setOrders(Array.isArray(incoming) ? incoming : []);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* ── Internal setter that always persists ── */
  const persist = React.useCallback((updater: (prev: StoredOrder[]) => StoredOrder[]): void => {
    setOrders(prev => {
      const next = updater(prev);
      writeToStorage(next);
      return next;
    });
  }, []);

  /* ── CRUD ── */

  const addOrder = React.useCallback((order: StoredOrder): void => {
    persist(prev => [order, ...prev]);
  }, [persist]);

  const bulkAdd = React.useCallback((incoming: StoredOrder[]): void => {
    persist(prev => {
      const existingIds = new Set(prev.map(o => o.id));
      const newOnes = incoming.filter(o => !existingIds.has(o.id));
      return [...newOnes, ...prev];
    });
  }, [persist]);

  const updateOrder = React.useCallback((id: string, patch: Partial<StoredOrder>): void => {
    persist(prev =>
      prev.map(o => o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o)
    );
  }, [persist]);

  const removeOrder = React.useCallback((id: string): void => {
    persist(prev => prev.filter(o => o.id !== id));
  }, [persist]);

  /* ── Convenience mutations ── */

  const cancelOrder = React.useCallback((id: string, note?: string): void => {
    persist(prev =>
      prev.map(o =>
        o.id === id
          ? { ...o, status: 'CANCELLED' as OrderStatus, updatedAt: Date.now(), ...(note ? { note } : {}) }
          : o
      )
    );
  }, [persist]);

  const completeOrder = React.useCallback((id: string): void => {
    persist(prev =>
      prev.map(o =>
        o.id === id
          ? { ...o, status: 'COMPLETED' as OrderStatus, updatedAt: Date.now() }
          : o
      )
    );
  }, [persist]);

  const markPaid = React.useCallback((id: string): void => {
    persist(prev =>
      prev.map(o =>
        o.id === id
          ? { ...o, paymentStatus: 'paid' as PaymentStatus, updatedAt: Date.now() }
          : o
      )
    );
  }, [persist]);

  const assignTechnician = React.useCallback(
    (id: string, name: string, phone: string): void => {
      persist(prev =>
        prev.map(o =>
          o.id === id
            ? {
                ...o,
                status:          'ASSIGNED' as OrderStatus,
                technicianName:  name,
                technicianPhone: phone,
                updatedAt:       Date.now(),
              }
            : o
        )
      );
    },
    [persist]
  );

  /* ── Queries ── */

  const getById = React.useCallback(
    (id: string): StoredOrder | undefined => orders.find(o => o.id === id),
    [orders]
  );

  const getFiltered = React.useCallback(
    (filter: OrderFilter, sort?: { by?: SortKey; dir?: SortDir }): StoredOrder[] =>
      applyFilter(orders, filter, sort),
    [orders]
  );

  const getByStatus = React.useCallback(
    (status: OrderStatus | OrderStatus[]): StoredOrder[] => {
      const statuses = Array.isArray(status) ? status : [status];
      return orders.filter(o => statuses.includes(o.status));
    },
    [orders]
  );

  const getByService = React.useCallback(
    (key: ServiceKey | ServiceKey[]): StoredOrder[] => {
      const keys = Array.isArray(key) ? key : [key];
      return orders.filter(o => keys.includes(o.serviceKey));
    },
    [orders]
  );

  /* ── Dev / seed ── */

  const replaceAll = React.useCallback((next: StoredOrder[]): void => {
    persist(() => next);
  }, [persist]);

  const clearAll = React.useCallback((): void => {
    persist(() => []);
  }, [persist]);

  /* ── Derived stats ── */
  const stats = React.useMemo(() => computeStats(orders), [orders]);

  return {
    orders,
    loading,
    stats,
    addOrder,
    bulkAdd,
    updateOrder,
    removeOrder,
    cancelOrder,
    completeOrder,
    markPaid,
    assignTechnician,
    getById,
    getFiltered,
    getByStatus,
    getByService,
    replaceAll,
    clearAll,
  };
}

/* ═══════════════════════════════════════════════════════════════
   CONTEXT  — share one instance across many components
═══════════════════════════════════════════════════════════════ */

const OrdersContext = React.createContext<UseOrdersReturn | null>(null);

/**
 * Wrap any subtree with <OrdersProvider> to share one orders state
 * across all children without extra hook calls or duplicate storage reads.
 *
 * @example
 * // app/customer/layout.tsx
 * export default function Layout({ children }) {
 *   return <OrdersProvider>{children}</OrdersProvider>;
 * }
 */
export function OrdersProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const value = useOrders();
  return React.createElement(OrdersContext.Provider, { value }, children);
}

/**
 * Consume shared orders state. Must be inside <OrdersProvider>.
 *
 * @example
 * const { orders, stats, cancelOrder } = useOrdersContext();
 */
export function useOrdersContext(): UseOrdersReturn {
  const ctx = React.useContext(OrdersContext);
  if (!ctx) {
    throw new Error(
      'useOrdersContext must be called inside <OrdersProvider>. ' +
      'Either wrap your layout, or call useOrders() directly.'
    );
  }
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
   STANDALONE UTILITIES  (no React — import freely anywhere)
═══════════════════════════════════════════════════════════════ */

/** Generate a unique order ID in AuroWater format e.g. "AW-10031234" */
export function generateOrderId(): string {
  return 'AW-' + (10_000_000 + Math.floor(Math.random() * 9_000_000)).toString();
}

/** Is a given status an "active" (non-terminal) status? */
export function isActiveStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Human-readable label for an order status */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:     'Pending',
  ASSIGNED:    'Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  CANCELLED:   'Cancelled',
};

/** Tailwind-free colour tokens for status chips */
export const STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; color: string; dot: string }
> = {
  PENDING:     { bg: '#FFF7ED', color: '#C2410C', dot: '#FB923C' },
  ASSIGNED:    { bg: '#EFF6FF', color: '#1D4ED8', dot: '#60A5FA' },
  IN_PROGRESS: { bg: '#EDE9FE', color: '#5B21B6', dot: '#8B5CF6' },
  COMPLETED:   { bg: '#ECFDF5', color: '#065F46', dot: '#34D399' },
  CANCELLED:   { bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF' },
};

/**
 * Build a new water-can order shell.
 * Fill in id, address, scheduledDate, and timeKey before saving.
 *
 * @example
 * const order = makeWaterCanOrder({
 *   quantity: 5,
 *   pricePerCan: 12,
 *   orderType: 'one_time',
 *   convenienceFee: 29,
 *   gstRate: 0.18,
 * });
 */
export function makeWaterCanOrder(opts: {
  quantity:        number;
  pricePerCan:     number;
  orderType:       'one_time' | 'subscription';
  frequency?:      'daily' | 'alternate' | 'weekly';
  isBisRo?:        boolean;
  convenienceFee?: number;
  gstRate?:        number;
  emergency?:      boolean;
  paymentMethod?:  PaymentMethod;
}): Omit<StoredOrder, 'id' | 'address' | 'scheduledDate' | 'timeKey'> {
  const conv     = opts.convenienceFee ?? 29;
  const gstRate  = opts.gstRate        ?? 0.18;
  const base     = Math.round(opts.quantity * opts.pricePerCan);
  const emg      = opts.emergency ? 199 : 0;
  const gst      = Math.round((base + conv) * gstRate);
  const total    = base + conv + emg + gst;
  const now      = Date.now();

  return {
    status:        'PENDING',
    createdAt:     now,
    updatedAt:     now,
    serviceKey:    'water_can',
    subOptionKey:  opts.orderType,
    emergency:     opts.emergency ?? false,
    total,
    paymentMethod: opts.paymentMethod ?? 'cash',
    paymentStatus: 'unpaid',
    canMeta: {
      quantity:    opts.quantity,
      orderType:   opts.orderType,
      frequency:   opts.frequency,
      pricePerCan: opts.pricePerCan,
      isBisRo:     opts.isBisRo ?? true,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
   LEGACY COMPATIBILITY
═══════════════════════════════════════════════════════════════ */

/** @deprecated All StoredOrder fields are the same; type alias kept for any old imports */
export type Order = StoredOrder;