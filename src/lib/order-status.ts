/**
 * Single source of truth for how an order looks to a customer.
 * Home, History and Track must all use this so every page agrees.
 */

export const ACTIVE_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] as const;
export const FLOW_STEPS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const;
export const STEP_LABELS = ['Placed', 'Assigned', 'In progress', 'Delivered'] as const;

export function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status.toUpperCase());
}

export function stepIndex(status: string): number {
  const i = (FLOW_STEPS as readonly string[]).indexOf(status.toUpperCase());
  return i >= 0 ? i : 0;
}

type StatusMeta = { label: string; badge: string; dot: string };

const STATUS_META: Record<string, StatusMeta> = {
  PENDING: { label: 'Pending', badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  ASSIGNED: { label: 'Assigned', badge: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  IN_PROGRESS: { label: 'In progress', badge: 'bg-violet-50 text-violet-800 ring-violet-200', dot: 'bg-violet-500' },
  COMPLETED: { label: 'Completed', badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', badge: 'bg-rose-50 text-rose-800 ring-rose-200', dot: 'bg-rose-500' },
  FAILED: { label: 'Failed', badge: 'bg-slate-100 text-slate-700 ring-slate-300', dot: 'bg-slate-500' },
};

export function statusMeta(status: string): StatusMeta {
  const s = status.toUpperCase();
  return STATUS_META[s] ?? { label: s.replace(/_/g, ' '), badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' };
}

const SERVICE_TITLES: Record<string, string> = {
  water_can: 'Water cans',
  water_tanker: 'Water tanker',
  ro_service: 'RO service',
  plumbing: 'Plumbing',
  borewell: 'Borewell',
  motor_pump: 'Motor & pump',
  tank_cleaning: 'Tank cleaning',
};

const SERVICE_EMOJI: Record<string, string> = {
  water_can: '💧',
  water_tanker: '🚚',
  ro_service: '🔧',
  plumbing: '🛠️',
  borewell: '⛏️',
  motor_pump: '⚙️',
  tank_cleaning: '✨',
};

export function serviceTitle(key: string | null | undefined): string {
  if (!key) return 'Service';
  return SERVICE_TITLES[key] ?? key.replace(/_/g, ' ');
}

export function serviceEmoji(key: string | null | undefined): string {
  return (key && SERVICE_EMOJI[key]) || '💧';
}

export type CustomerOrder = {
  id: string;
  shortId: string;
  status: string;
  totalAmount: number;
  canCount: number | null;
  serviceKey: string;
  serviceTitle: string;
  createdAt: string;
  scheduledAt: string | null;
  slot: string;
  address: string;
  supplierId: string | null;
  hasReview: boolean;
  paymentMethod: string;
  paymentStatus: string;
  subscriptionId: string | null;
  canOrderType: string | null;
  canFrequency: string | null;
  canPricePerUnit: number | null;
};

/** Converts the raw API row (new DB columns + compat names) into one clean shape. */
export function normalizeOrder(raw: Record<string, unknown>): CustomerOrder {
  const id = String(raw.id ?? '');
  const serviceKey = String(raw.service_type_key ?? raw.service_type ?? '');
  const note = String(raw.note ?? raw.notes ?? '');
  const slotMatch = /Slot:\s*([^|]+)/.exec(note);
  const rawSlot = slotMatch ? slotMatch[1].trim() : String(raw.time_slot ?? '');
  const canRaw = raw.can_count ?? raw.can_quantity;

  return {
    id,
    shortId: String(raw.order_number ?? id.slice(0, 8)).toUpperCase(),
    status: String(raw.status ?? 'PENDING').toUpperCase(),
    totalAmount: Number(raw.total_amount ?? 0) || 0,
    canCount: canRaw == null || canRaw === '' ? null : Number(canRaw),
    serviceKey,
    serviceTitle: serviceTitle(serviceKey),
    createdAt: String(raw.created_at ?? new Date().toISOString()),
    scheduledAt: raw.scheduled_at ? String(raw.scheduled_at) : null,
    slot: rawSlot,
    address: String(raw.address ?? ''),
    supplierId: raw.supplier_id ? String(raw.supplier_id) : null,
    hasReview: raw.rating != null || Boolean(raw.has_review),
    paymentMethod: String(raw.payment_method ?? 'cash'),
    paymentStatus: String(raw.payment_status ?? 'pending'),
    subscriptionId: raw.subscription_id ? String(raw.subscription_id) : null,
    canOrderType: raw.can_order_type ? String(raw.can_order_type) : null,
    canFrequency: raw.can_frequency ? String(raw.can_frequency) : null,
    canPricePerUnit:
      raw.can_price_per_unit == null
        ? null
        : Number(raw.can_price_per_unit),
  };
}

function to12h(match: string, h: string, m: string): string {
  void match;
  let hour = parseInt(h, 10);
  const ap = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ap}`;
}

export function prettySlot(slot: string): string {
  if (!slot) return '';
  return slot.replace(/(\d{1,2}):(\d{2})/g, to12h).replace(/\s*-\s*/g, ' – ');
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "Sun, 4 Oct · 3:30 AM – 4:00 AM" */
export function scheduleLabel(o: CustomerOrder): string {
  const day = formatDay(o.scheduledAt);
  const slot = prettySlot(o.slot);
  return [day, slot].filter(Boolean).join(' · ');
}

/** What the customer should be told right now. */
export function liveMessage(o: CustomerOrder): { title: string; sub: string } {
  switch (o.status) {
    case 'PENDING':
      return o.supplierId
        ? { title: 'Order received', sub: 'Your supplier is confirming the delivery.' }
        : { title: 'Finding your supplier', sub: 'We are checking nearby suppliers. This updates automatically.' };
    case 'ASSIGNED':
      return { title: 'Supplier assigned', sub: 'Your supplier is getting ready for your delivery.' };
    case 'IN_PROGRESS':
      return { title: 'Delivery in progress', sub: 'Keep your phone nearby.' };
    case 'COMPLETED':
      return { title: 'Delivered', sub: 'Thanks for choosing AuroWater.' };
    case 'CANCELLED':
      return { title: 'Order cancelled', sub: 'You can book again anytime.' };
    default:
      return { title: statusMeta(o.status).label, sub: '' };
  }
}

export function reorderHref(o: CustomerOrder): string {
  const sp = new URLSearchParams();
  if (o.serviceKey) sp.set('service', o.serviceKey);
  if (o.serviceKey === 'water_can' && o.canCount && o.canCount > 0) sp.set('cans', String(o.canCount));
  const q = sp.toString();
  return `/book${q ? `?${q}` : ''}`;
}

export function inrFmt(n: number): string {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}
