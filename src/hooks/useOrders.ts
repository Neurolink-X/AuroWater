'use client';

import React from 'react';

export type ServiceKey =
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

export type OrderStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type Address = {
  id: string;
  houseFlat: string;
  area: string;
  city: string;
  pincode: string;
  landmark?: string;
  label?: string;
  createdAt: number;
  isDefault?: boolean;
};

export type StoredOrder = {
  id: string;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  serviceKey: ServiceKey;
  subOptionKey: string;
  address: Address;
  scheduledDate: string;
  timeKey: string;
  emergency: boolean;
  total: number;
  paymentMethod: 'cash' | 'online';
  paymentStatus: 'unpaid' | 'paid';
  technicianName?: string;
  technicianPhone?: string;
};

const STORAGE_KEY = 'aw3_orders';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeOrders(orders: StoredOrder[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function useOrders() {
  const [orders, setOrders] = React.useState<StoredOrder[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromLs = safeParse<StoredOrder[]>(localStorage.getItem(STORAGE_KEY));
    setOrders(Array.isArray(fromLs) ? fromLs : []);
    setLoading(false);
  }, []);

  const addOrder = React.useCallback((order: StoredOrder) => {
    setOrders((prev) => {
      const next = [order, ...prev];
      writeOrders(next);
      return next;
    });
  }, []);

  const updateOrder = React.useCallback((id: string, patch: Partial<StoredOrder>) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o));
      writeOrders(next);
      return next;
    });
  }, []);

  const removeOrder = React.useCallback((id: string) => {
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      writeOrders(next);
      return next;
    });
  }, []);

  const stats = React.useMemo(() => {
    const total = orders.length;
    const active = orders.filter((o) => o.status === 'PENDING' || o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS').length;
    const completed = orders.filter((o) => o.status === 'COMPLETED').length;
    const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
    const completedRevenue = orders
      .filter((o) => o.status === 'COMPLETED')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    return { total, active, completed, cancelled, completedRevenue };
  }, [orders]);

  return {
    orders,
    loading,
    stats,
    addOrder,
    updateOrder,
    removeOrder,
  };
}

