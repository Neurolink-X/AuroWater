/**
 * Supabase Database types — aligned with sql/001_core_schema.sql and migrations.
 * Regenerate from Supabase CLI when schema changes: `supabase gen types typescript`
 */
import type {
  AddressRow,
  ApplicationRow,
  AuditLogRow,
  FoundingMemberRow,
  FraudFlagRow,
  LoginAttemptRow,
  NotificationRow,
  OrderRow,
  OtpRequestRow,
  PayoutRow,
  PlumberBookingRow,
  ProfileRow,
  ReviewRow,
  ServiceTypeRow,
  SettingsRow,
  SupplierSettingsRow,
  SupplierStockRow,
} from '@/lib/db/types';

export type {
  AddressRow,
  ApplicationRow,
  AuditLogRow,
  FoundingMemberRow,
  FraudFlagRow,
  LoginAttemptRow,
  NotificationRow,
  OrderRow,
  OtpRequestRow,
  PayoutRow,
  PlumberBookingRow,
  ProfileRow,
  ReviewRow,
  ServiceTypeRow,
  SettingsRow,
  SupplierSettingsRow,
  SupplierStockRow,
};

export type UserRow = ProfileRow;

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow> };
      addresses: { Row: AddressRow; Insert: Partial<AddressRow>; Update: Partial<AddressRow> };
      orders: { Row: OrderRow; Insert: Partial<OrderRow>; Update: Partial<OrderRow> };
      service_types: { Row: ServiceTypeRow; Insert: Partial<ServiceTypeRow>; Update: Partial<ServiceTypeRow> };
      settings: { Row: SettingsRow; Insert: Partial<SettingsRow>; Update: Partial<SettingsRow> };
      notifications: { Row: NotificationRow; Insert: Partial<NotificationRow>; Update: Partial<NotificationRow> };
      reviews: { Row: ReviewRow; Insert: Partial<ReviewRow>; Update: Partial<ReviewRow> };
      payouts: { Row: PayoutRow; Insert: Partial<PayoutRow>; Update: Partial<PayoutRow> };
      applications: { Row: ApplicationRow; Insert: Partial<ApplicationRow>; Update: Partial<ApplicationRow> };
      supplier_settings: { Row: SupplierSettingsRow; Insert: Partial<SupplierSettingsRow>; Update: Partial<SupplierSettingsRow> };
      supplier_stock: { Row: SupplierStockRow; Insert: Partial<SupplierStockRow>; Update: Partial<SupplierStockRow> };
      founding_members: { Row: FoundingMemberRow; Insert: Partial<FoundingMemberRow>; Update: Partial<FoundingMemberRow> };
      audit_logs: { Row: AuditLogRow; Insert: Partial<AuditLogRow>; Update: Partial<AuditLogRow> };
      fraud_flags: { Row: FraudFlagRow; Insert: Partial<FraudFlagRow>; Update: Partial<FraudFlagRow> };
      login_attempts: { Row: LoginAttemptRow; Insert: Partial<LoginAttemptRow>; Update: Partial<LoginAttemptRow> };
      otp_requests: { Row: OtpRequestRow; Insert: Partial<OtpRequestRow>; Update: Partial<OtpRequestRow> };
      plumber_bookings: { Row: PlumberBookingRow; Insert: Partial<PlumberBookingRow>; Update: Partial<PlumberBookingRow> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
