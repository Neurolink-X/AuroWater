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

const TECHNICIAN_SERVICE_KEYS = new Set([
  'plumbing',
  'ro_service',
  'borewell',
  'motor_pump',
  'tank_cleaning',
]);

export function isTechnicianServiceKey(serviceKey: string | null | undefined): boolean {
  return Boolean(serviceKey && TECHNICIAN_SERVICE_KEYS.has(serviceKey.toLowerCase()));
}

/** What the customer should be told right now. Keep wording service-aware across Home and History. */
export function liveMessage(o: CustomerOrder): { title: string; sub: string; hindi: string } {
  const technicianService = isTechnicianServiceKey(o.serviceKey);
  const provider = o.serviceKey === 'plumbing' ? 'plumber' : 'technician';
  switch (o.status) {
    case 'PENDING':
      if (technicianService) {
        return {
          title: 'Finding your professional',
          sub: `We are checking availability for a ${provider}. This updates automatically.`,
          hindi: 'हम आपके क्षेत्र में सही प्लंबर/टेक्नीशियन ढूँढ रहे हैं।',
        };
      }
      return o.supplierId
        ? { title: 'Order received', sub: 'Your supplier is confirming the delivery.', hindi: 'आपका ऑर्डर मिल गया है। सप्लायर की पुष्टि का इंतज़ार है।' }
        : { title: 'Finding your supplier', sub: 'We are checking nearby suppliers. This updates automatically.', hindi: 'हम आपके क्षेत्र में पानी सप्लायर ढूँढ रहे हैं।' };
    case 'ASSIGNED':
      return technicianService
        ? {
            title: `${o.serviceKey === 'plumbing' ? 'Plumber' : 'Technician'} assigned`,
            sub: 'Your professional has been assigned. They may still need to accept the job.',
            hindi: 'प्रोफेशनल असाइन हो गया है। काम स्वीकार होने की पुष्टि का इंतज़ार हो सकता है।',
          }
        : { title: 'Supplier assigned', sub: 'Your supplier is getting ready for your delivery.', hindi: 'सप्लायर असाइन हो गया है और डिलीवरी की तैयारी कर रहा है।' };
    case 'IN_PROGRESS':
      return technicianService
        ? { title: 'Service in progress', sub: 'Your professional is working on your service. Keep your phone nearby.', hindi: 'आपकी सर्विस का काम चल रहा है। कृपया फ़ोन पास रखें।' }
        : { title: 'Delivery in progress', sub: 'Keep your phone nearby.', hindi: 'डिलीवरी के समय फ़ोन पास रखें।' };
    case 'COMPLETED':
      return technicianService
        ? { title: 'Service completed', sub: 'Your service is complete. Please review your experience.', hindi: 'काम पूरा हो गया है। कृपया अपना अनुभव साझा करें।' }
        : { title: 'Delivered', sub: 'Thanks for choosing AuroWater.', hindi: 'AuroTap चुनने के लिए धन्यवाद।' };
    case 'CANCELLED':
      return { title: 'Order cancelled', sub: 'You can book again anytime.', hindi: 'ऑर्डर रद्द हो गया है। आप कभी भी दोबारा बुक कर सकते हैं।' };
    default:
      return { title: statusMeta(o.status).label, sub: '', hindi: '' };
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
