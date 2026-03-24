// User Types
export type UserRole = 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';

export interface User {
  id: number;
  phone: string;
  email?: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Address {
  id: number;
  user_id: number;
  house_no: string;
  area: string;
  landmark?: string;
  city: string;
  pincode: string;
  lat?: number;
  lng?: number;
  address_type: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Technician {
  id: number;
  user_id: number;
  specialization?: string;
  license_number?: string;
  experience_years?: number;
  current_zone_id?: number;
  is_available: boolean;
  current_lat?: number;
  current_lng?: number;
  rating: number;
  total_jobs: number;
  created_at: Date;
  updated_at: Date;
}

// Service Types
export type ServiceTypeEnum = 'WATER_SUPPLY' | 'SUBMERSIBLE_INSTALLATION' | 'REPAIR_MAINTENANCE';

export interface ServiceType {
  id: number;
  name: ServiceTypeEnum;
  description?: string;
  base_price: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Zone
export interface Zone {
  id: number;
  name: string;
  city: string;
  distance_factor: number;
  base_lat?: number;
  base_lng?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Pricing
export interface PricingRule {
  id: number;
  service_type_id: number;
  zone_id?: number;
  base_price: number;
  distance_multiplier: number;
  tax_percentage: number;
  min_order_value: number;
  emergency_charge: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Order Types
export type OrderStatus = 'PENDING' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Order {
  id: number;
  customer_id: number;
  address_id: number;
  service_type_id: number;
  technician_id?: number;
  zone_id?: number;
  service_details?: any;
  base_price: number;
  distance_factor: number;
  subtotal: number;
  tax_amount: number;
  emergency_charge: number;
  total_amount: number;
  scheduled_time?: Date;
  time_slot?: string;
  status: OrderStatus;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// Job Types
export type JobStatus = 'PENDING' | 'ACCEPTED' | 'ON_THE_WAY' | 'WORKING' | 'COMPLETED' | 'REJECTED';

export interface Job {
  id: number;
  order_id: number;
  technician_id: number;
  status: JobStatus;
  assigned_at: Date;
  accepted_at?: Date;
  completed_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// Notification
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type?: string;
  related_id?: number;
  is_read: boolean;
  created_at: Date;
}

// API Request/Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthToken {
  token: string;
  user: User;
}

export interface PricingResponse {
  base_price: number;
  distance_factor: number;
  distance_charge?: number;
  tax_percentage?: number;
  subtotal: number;
  tax_amount: number;
  emergency_charge: number;
  total_amount: number;
}
