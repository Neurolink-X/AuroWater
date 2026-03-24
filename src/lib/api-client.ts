import { ApiResponse, AuthToken, User } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Storage helpers
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

export function setUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user');
}

// Generic API call function
async function apiCall<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    requireAuth?: boolean;
  } = {}
): Promise<T> {
  const {
    method = 'GET',
    body = undefined,
    requireAuth = false,
  } = options;

  const headers: any = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      clearUser();
    }
    const errorData = await response.json();
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

// Auth APIs
export async function register(
  phone: string,
  password: string,
  full_name: string,
  email?: string,
  role: string = 'CUSTOMER',
  technicianExtra?: { specialization?: string; experience_years?: number; license_number?: string }
): Promise<AuthToken> {
  void phone;
  void password;
  void full_name;
  void email;
  void role;
  void technicianExtra;
  throw new Error('Registration is disabled.');
}

export async function login(phone: string, password: string): Promise<AuthToken> {
  void phone;
  void password;
  throw new Error('Login is disabled.');
}

export async function verifyToken(): Promise<AuthToken> {
  throw new Error('Authentication is disabled.');
}

export function logout(): void {
  clearToken();
  clearUser();
}

// Customer APIs
export async function getAddresses(): Promise<any[]> {
  const response = await apiCall<ApiResponse<any[]>>('/customers/addresses', {
    method: 'GET',
    requireAuth: true,
  });

  if (response.success) {
    return response.data || [];
  }

  throw new Error(response.error || 'Failed to fetch addresses');
}

export async function addAddress(addressData: any): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/customers/addresses', {
    method: 'POST',
    body: addressData,
    requireAuth: true,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to add address');
}

export async function updateAddress(id: number, addressData: any): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/customers/addresses', {
    method: 'PUT',
    body: { id, ...addressData },
    requireAuth: true,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to update address');
}

export async function deleteAddress(id: number): Promise<void> {
  const response = await apiCall<ApiResponse<null>>(
    `/customers/addresses?id=${id}`,
    {
      method: 'DELETE',
      requireAuth: true,
    }
  );

  if (!response.success) {
    throw new Error(response.error || 'Failed to delete address');
  }
}

export async function getServices(): Promise<any[]> {
  const response = await apiCall<ApiResponse<any[]>>('/customers/services', {
    method: 'GET',
  });

  if (response.success) {
    return response.data || [];
  }

  throw new Error(response.error || 'Failed to fetch services');
}

export async function calculatePrice(priceData: any): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/customers/calculate-price', {
    method: 'POST',
    body: priceData,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to calculate price');
}

export async function createOrder(orderData: any): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/customers/orders', {
    method: 'POST',
    body: orderData,
    requireAuth: true,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to create order');
}

export async function getOrders(status?: string, limit: number = 10, offset: number = 0): Promise<any[]> {
  let endpoint = '/customers/orders?limit=' + limit + '&offset=' + offset;
  if (status) {
    endpoint += '&status=' + status;
  }

  const response = await apiCall<ApiResponse<any[]>>(endpoint, {
    method: 'GET',
    requireAuth: true,
  });

  if (response.success) {
    return response.data || [];
  }

  throw new Error(response.error || 'Failed to fetch orders');
}

export async function getOrderDetail(id: string): Promise<any> {
  const response = await apiCall<ApiResponse<any>>(`/customers/orders/${id}`, {
    method: 'GET',
    requireAuth: true,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to fetch order');
}

// Technician APIs
export async function getTechnicianProfile(): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/technicians/profile', {
    method: 'GET',
    requireAuth: true,
  });
  if (response.success) return response.data;
  throw new Error(response.error || 'Failed to fetch profile');
}

export async function updateTechnicianProfile(data: {
  specialization?: string;
  license_number?: string;
  experience_years?: number;
  current_zone_id?: number;
  is_available?: boolean;
}): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/technicians/profile', {
    method: 'PUT',
    body: data,
    requireAuth: true,
  });
  if (response.success) return response.data;
  throw new Error(response.error || 'Failed to update profile');
}

export async function getTechnicianJobs(status: string = 'PENDING'): Promise<any[]> {
  const response = await apiCall<ApiResponse<any[]>>(
    `/technicians/jobs?status=${status}`,
    {
      method: 'GET',
      requireAuth: true,
    }
  );

  if (response.success) {
    return response.data || [];
  }

  throw new Error(response.error || 'Failed to fetch jobs');
}

export async function getTechnicianJobDetail(jobId: number): Promise<any> {
  const response = await apiCall<ApiResponse<any>>(`/technicians/jobs/${jobId}`, {
    method: 'GET',
    requireAuth: true,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to fetch job');
}

export async function updateJobStatus(job_id: number, action: string, notes?: string): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/technicians/jobs', {
    method: 'POST',
    body: { job_id, action, notes },
    requireAuth: true,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to update job');
}

// Admin APIs
export async function getAdminDashboard(): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/admin/dashboard', {
    method: 'GET',
    requireAuth: true,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to fetch dashboard');
}

export async function getAdminOrders(status?: string, limit: number = 20, offset: number = 0): Promise<any[]> {
  let endpoint = '/admin/orders?limit=' + limit + '&offset=' + offset;
  if (status) {
    endpoint += '&status=' + status;
  }

  const response = await apiCall<ApiResponse<any[]>>(endpoint, {
    method: 'GET',
    requireAuth: true,
  });

  if (response.success) {
    return response.data || [];
  }

  throw new Error(response.error || 'Failed to fetch orders');
}

export async function assignTechnician(order_id: number, technician_id: number): Promise<any> {
  const response = await apiCall<ApiResponse<any>>('/admin/orders', {
    method: 'PUT',
    body: { order_id, technician_id, action: 'assign' },
    requireAuth: true,
  });

  if (response.success) {
    return response.data;
  }

  throw new Error(response.error || 'Failed to assign technician');
}

export async function getPricingRules(): Promise<any[]> {
  const response = await apiCall<ApiResponse<any[]>>('/admin/pricing', {
    method: 'GET',
    requireAuth: true,
  });

  if (response.success) {
    return response.data || [];
  }

  throw new Error(response.error || 'Failed to fetch pricing rules');
}

export async function getAdminUsers(role?: string, limit: number = 20, offset: number = 0): Promise<any[]> {
  let endpoint = '/admin/users?limit=' + limit + '&offset=' + offset;
  if (role) {
    endpoint += '&role=' + role;
  }

  const response = await apiCall<ApiResponse<any[]>>(endpoint, {
    method: 'GET',
    requireAuth: true,
  });

  if (response.success) {
    return response.data || [];
  }

  throw new Error(response.error || 'Failed to fetch users');
}
