// /**
//  * Database row types for Supabase `public` schema (Phase 2 migrations).
//  * Use these instead of `any` in API routes and the typed client.
//  */

// export type ProfileRole = 'customer' | 'technician' | 'supplier' | 'admin';

// export interface ProfileRow {
//   id: string;
//   full_name: string;
//   email: string;
//   phone: string | null;
//   city?: string | null;
//   role: ProfileRole;
//   aurotap_id: string | null;
//   avatar_url: string | null;
//   /** false = blocked; null/undefined treated as active (matches DB default). */
//   is_active?: boolean | null;
//   /** Optional account lifecycle (if present in DB). */
//   status?: string | null;
//   created_at: string;
//   updated_at: string;
// }

// export interface ServiceTypeRow {
//   id: number;
//   key: string;
//   name: string;
//   description: string | null;
//   base_price: string | number;
//   unit: string;
//   is_active: boolean;
//   sort_order: number;
// }

// export interface AddressRow {
//   id: string;
//   user_id: string;
//   label: string | null;
//   house_flat: string;
//   area: string;
//   city: string;
//   pincode: string;
//   landmark: string | null;
//   is_default: boolean;
//   created_at: string;
// }

// export type OrderStatus =
//   | 'PENDING'
//   | 'ASSIGNED'
//   | 'IN_PROGRESS'
//   | 'COMPLETED'
//   | 'CANCELLED';

// export interface OrderRow {
//   id: string;
//   order_number: string;
//   customer_id: string;
//   supplier_id: string | null;
//   technician_id: string | null;
//   service_type_id: number;
//   sub_option_key: string | null;
//   address_id: string | null;
//   address_snapshot: Record<string, unknown> | null;
//   scheduled_date: string | null;
//   time_slot: string | null;
//   scheduled_time: string | null;
//   status: OrderStatus;
//   base_amount: string | number;
//   convenience_fee: string | number;
//   emergency_charge: string | number;
//   gst_amount: string | number;
//   total_amount: string | number;
//   supplier_payout: string | number;
//   platform_fee: string | number;
//   payment_method: string | null;
//   payment_status: string;
//   payout_status: string;
//   is_emergency: boolean;
//   cancellation_reason: string | null;
//   notes: string | null;
//   can_quantity: number | null;
//   can_price_per_unit: string | number | null;
//   can_order_type: string | null;
//   can_frequency: string | null;
//   created_at: string;
//   updated_at: string;
// }

// export interface SettingsRow {
//   key: string;
//   value: string;
//   updated_at: string;
// }

// export interface NotificationRow {
//   id: string;
//   user_id: string;
//   title: string;
//   body: string;
//   type: string;
//   order_id: string | null;
//   is_read: boolean;
//   created_at: string;
// }

// export interface ReviewRow {
//   id: string;
//   order_id: string;
//   customer_id: string;
//   rating: number;
//   comment: string | null;
//   created_at: string;
// }

// export interface PayoutRow {
//   id: string;
//   supplier_id: string;
//   amount: string | number;
//   method: string | null;
//   reference: string | null;
//   paid_at: string;
//   notes: string | null;
// }

// export interface ContactSubmissionRow {
//   id: string;
//   name: string;
//   email: string;
//   phone: string | null;
//   message: string;
//   created_at: string;
// }



/**
 * src/lib/types/db.ts
 *
 * TypeScript row types for every table in public.* schema.
 * Reconciled against sql/001_core_schema.sql — every field name
 * and type matches the actual Postgres column exactly.
 *
 * Rules:
 *   - Nullable DB columns → `field: T | null`
 *   - Columns with DEFAULT that are never null in practice → `field: T`
 *   - JSON/JSONB columns → `Record<string, unknown> | null` (narrow at use-site)
 *   - Numeric/decimal → `string | number` (Supabase JS returns string for NUMERIC)
 *   - Arrays  → `string[]` (Supabase JS returns JS array for Postgres ARRAY)
 */

/* ══════════════════════════════════════════════════
   SHARED ENUMS / UNIONS
══════════════════════════════════════════════════ */

export type ProfileRole    = 'customer' | 'supplier' | 'technician' | 'admin';
export type ProfileStatus  = 'active'   | 'suspended' | 'pending' | 'banned';

export type OrderStatus    = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type PaymentStatus  = 'pending' | 'paid' | 'refunded' | 'failed';

export type ApplicationType   = 'supplier' | 'technician';
export type ApplicationStatus = 'pending'  | 'approved' | 'rejected';

export type PayoutRole   = 'supplier' | 'technician';
export type PayoutStatus = 'pending'  | 'approved' | 'paid' | 'rejected';

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FoundingPlan = 'basic' | 'silver' | 'gold';

/* ══════════════════════════════════════════════════
   profiles
══════════════════════════════════════════════════ */

export interface ProfileRow {
  /** Same UUID as auth.users.id */
  id:            string;
  email:         string | null;
  phone:         string | null;
  /** maps to full_name in DB */
  full_name:     string | null;
  role:          ProfileRole;
  status:        ProfileStatus;
  city:          string | null;
  avatar_url:    string | null;
  /** Derived / optional fields used across app versions */
  aurotap_id?:         string | null;
  referral_code?:      string | null;
  referred_by?:        string | null;
  referral_credits?:   number | null;
  tier?:               'bronze' | 'silver' | 'gold' | 'platinum' | string;
  is_active?:          boolean | null;
  last_seen_at?:       string | null;
  language?:           string | null;
  deleted_at?:         string | null;
  device_token?:       string | null;
  /** Legacy/other surfaces (may come from joins/views) */
  is_online?:          boolean | null;
  whatsapp?:           string | null;
  created_at:    string;
  updated_at:    string;
}

/* ══════════════════════════════════════════════════
   addresses
══════════════════════════════════════════════════ */

export interface AddressRow {
  id:          string;
  customer_id: string;
  label:       string | null;
  /** DB column: line1 */
  line1:       string;
  /** DB column: line2 */
  line2:       string | null;
  city:        string;
  state:       string;
  pincode:     string | null;
  lat:         number | null;
  lng:         number | null;
  is_default:  boolean;
  created_at:  string;
}

/* ══════════════════════════════════════════════════
   orders
══════════════════════════════════════════════════ */

export interface OrderRow {
  id:             string;
  customer_id:    string | null;
  supplier_id:    string | null;
  technician_id:  string | null;
  /** DB default: 'water_can' */
  service_type:   string;
  status:         OrderStatus;
  can_count:      number | null;
  total_amount:   string | number;
  platform_fee:   string | number;
  payment_status: PaymentStatus;
  payment_method: string | null;
  address:        string | null;
  address_id:     string | null;
  is_emergency:   boolean;
  note:           string | null;
  cancel_reason:  string | null;
  scheduled_at:   string | null;
  accepted_at:    string | null;
  completed_at:   string | null;
  cancelled_at?:  string | null;
  tracking_url:   string | null;
  supplier_note:  string | null;
  dispatched_at:  string | null;
  /** 1–5 rating stored on order for quick reads */
  rating:         number | null;
  review_text?:   string | null;
  otp?:           string | null;
  otp_verified?:  boolean | null;
  source?:        string | null;
  promo_code?:    string | null;
  discount_amount?: string | number | null;
  final_amount?:  string | number | null;
  assigned_at?:   string | null;
  notified_at?:   string | null;
  created_at:     string;
  updated_at:     string;
}

/* ══════════════════════════════════════════════════
   notifications
══════════════════════════════════════════════════ */

export interface NotificationRow {
  id:         string;
  user_id:    string;
  type:       string;
  title:      string;
  /** DB column: message (not body) */
  message:    string;
  data:       Record<string, unknown> | null;
  is_read:    boolean;
  dedup_key:  string | null;
  created_at: string;
}

/* ══════════════════════════════════════════════════
   reviews
══════════════════════════════════════════════════ */

export interface ReviewRow {
  id:          string;
  order_id:    string;
  customer_id: string;
  supplier_id: string | null;
  /** DB column: stars (not rating) */
  stars:       number;
  /** max 120 chars enforced in DB */
  comment:     string | null;
  created_at:  string;
}

/* ══════════════════════════════════════════════════
   service_types
══════════════════════════════════════════════════ */

export interface ServiceTypeRow {
  id:          number;
  key:         string;
  label:       string;
  description: string | null;
  base_price:  string | number;
  is_active:   boolean;
  created_at:  string;
}

/* ══════════════════════════════════════════════════
   settings
══════════════════════════════════════════════════ */

export interface SettingsRow {
  key:        string;
  value:      string;
  updated_at: string;
}

/** Typed map of well-known settings keys */
export interface AppSettings {
  whatsapp_enabled:                  string;
  whatsapp_number:                   string;
  support_phone:                     string;
  support_email:                     string;
  default_can_price:                 string;
  platform_fee:                      string;
  emergency_fee:                     string;
  max_cans_per_order:                string;
  min_cans_per_order:                string;
  founding_member_limit:             string;
  booking_fee_plumber:               string;
  app_name:                          string;
  app_tagline:                       string;
  service_area:                      string;
  currency:                          string;
  currency_symbol:                   string;
  order_cancellation_window_minutes: string;
  review_window_days:                string;
  referral_bonus_amount:             string;
  [key: string]:                     string;  // allow extra keys
}

/* ══════════════════════════════════════════════════
   supplier_settings
══════════════════════════════════════════════════ */

export interface SupplierSettingsRow {
  id:              string;
  user_id:         string;
  is_online:       boolean;
  price_per_can:   string | number;
  service_radius:  number;
  auto_accept:     boolean;
  upi_id:          string | null;
  qr_code_url:     string | null;
  bank_account:    string | null;
  ifsc:            string | null;
  business_name:   string | null;
  updated_at:      string;
}

/* ══════════════════════════════════════════════════
   supplier_stock
══════════════════════════════════════════════════ */

export interface SupplierStockRow {
  id:               string;
  supplier_id:      string;
  cans_available:   number;
  low_stock_alert:  number;
  updated_at:       string;
}

/* ══════════════════════════════════════════════════
   plumber_bookings
══════════════════════════════════════════════════ */

export interface PlumberBookingRow {
  id:             string;
  customer_id:    string;
  plumber_id:     string | null;
  service_type:   string;
  time_slot:      string;
  scheduled_date: string;
  address:        string;
  booking_fee:    string | number;
  status:         BookingStatus;
  note:           string | null;
  created_at:     string;
  updated_at:     string;
}

/* ══════════════════════════════════════════════════
   applications
══════════════════════════════════════════════════ */

export interface ApplicationRow {
  id:              string;
  user_id:         string | null;
  type:            ApplicationType;
  status:          ApplicationStatus;
  business_name:   string | null;
  gstin:           string | null;
  bank_account:    string | null;
  ifsc:            string | null;
  skills:          string[] | null;
  documents:       Record<string, unknown> | null;
  rejection_note:  string | null;
  reviewed_by:     string | null;
  reviewed_at:     string | null;
  created_at:      string;
  updated_at:      string;
}

/* ══════════════════════════════════════════════════
   payouts
══════════════════════════════════════════════════ */

export interface PayoutRow {
  id:           string;
  user_id:      string;
  role:         PayoutRole;
  amount:       string | number;
  status:       PayoutStatus;
  upi_id:       string | null;
  bank_account: string | null;
  ifsc:         string | null;
  note:         string | null;
  approved_by:  string | null;
  approved_at:  string | null;
  created_at:   string;
  updated_at:   string;
}

/* ══════════════════════════════════════════════════
   founding_members
══════════════════════════════════════════════════ */

export interface FoundingMemberRow {
  id:        string;
  user_id:   string | null;
  name:      string;
  phone:     string;
  email:     string | null;
  city:      string | null;
  plan:      FoundingPlan | null;
  serial_no: number;
  joined_at: string;
}

/* ══════════════════════════════════════════════════
   audit_logs
══════════════════════════════════════════════════ */

export interface AuditLogRow {
  id:         string;
  actor_id:   string | null;
  action:     string;
  entity:     string;
  entity_id:  string | null;
  meta:       Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

/* ══════════════════════════════════════════════════
   fraud_flags
══════════════════════════════════════════════════ */

export interface FraudFlagRow {
  id:           string;
  user_id:      string | null;
  order_id:     string | null;
  reason:       string;
  severity:     FraudSeverity;
  resolved:     boolean;
  resolved_by:  string | null;
  resolved_at:  string | null;
  created_at:   string;
}

/* ══════════════════════════════════════════════════
   login_attempts
══════════════════════════════════════════════════ */

export interface LoginAttemptRow {
  id:         string;
  identifier: string;
  ip_address: string | null;
  success:    boolean;
  role:       string | null;
  created_at: string;
}

/* ══════════════════════════════════════════════════
   otp_requests
══════════════════════════════════════════════════ */

export interface OtpRequestRow {
  id:         string;
  phone:      string;
  code:       string;
  expires_at: string;
  used:       boolean;
  ip_address: string | null;
  attempts:   number;
  created_at: string;
}

/* ══════════════════════════════════════════════════
   UTILITY TYPES
══════════════════════════════════════════════════ */

/** Strip DB timestamps for insert payloads */
export type InsertPayload<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/** Partial update payload */
export type UpdatePayload<T> = Partial<InsertPayload<T>>;

/** Supabase query result with typed data */
export interface DbResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface DbResultList<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}