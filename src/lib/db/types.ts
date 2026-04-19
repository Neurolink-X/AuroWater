/**
 * Database row types for Supabase `public` schema (Phase 2 migrations).
 * Use these instead of `any` in API routes and the typed client.
 */

export type ProfileRole = 'customer' | 'technician' | 'supplier' | 'admin';

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: ProfileRole;
  aurotap_id: string | null;
  avatar_url: string | null;
  /** false = blocked; null/undefined treated as active (matches DB default). */
  is_active?: boolean | null;
  /** Optional account lifecycle (if present in DB). */
  status?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceTypeRow {
  id: number;
  key: string;
  name: string;
  description: string | null;
  base_price: string | number;
  unit: string;
  is_active: boolean;
  sort_order: number;
}

export interface AddressRow {
  id: string;
  user_id: string;
  label: string | null;
  house_flat: string;
  area: string;
  city: string;
  pincode: string;
  landmark: string | null;
  is_default: boolean;
  created_at: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  supplier_id: string | null;
  technician_id: string | null;
  service_type_id: number;
  sub_option_key: string | null;
  address_id: string | null;
  address_snapshot: Record<string, unknown> | null;
  scheduled_date: string | null;
  time_slot: string | null;
  scheduled_time: string | null;
  status: OrderStatus;
  base_amount: string | number;
  convenience_fee: string | number;
  emergency_charge: string | number;
  gst_amount: string | number;
  total_amount: string | number;
  supplier_payout: string | number;
  platform_fee: string | number;
  payment_method: string | null;
  payment_status: string;
  payout_status: string;
  is_emergency: boolean;
  cancellation_reason: string | null;
  notes: string | null;
  can_quantity: number | null;
  can_price_per_unit: string | number | null;
  can_order_type: string | null;
  can_frequency: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  order_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface PayoutRow {
  id: string;
  supplier_id: string;
  amount: string | number;
  method: string | null;
  reference: string | null;
  paid_at: string;
  notes: string | null;
}

export interface ContactSubmissionRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  created_at: string;
}
