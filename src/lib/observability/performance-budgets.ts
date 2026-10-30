export const WEB_VITALS_BUDGETS = {
  LCP: { target: 2500, unit: 'ms', label: 'Largest Contentful Paint' },
  INP: { target: 200, unit: 'ms', label: 'Interaction to Next Paint' },
  CLS: { target: 0.1, unit: 'score', label: 'Cumulative Layout Shift' },
  FCP: { target: 1800, unit: 'ms', label: 'First Contentful Paint' },
  TTFB: { target: 800, unit: 'ms', label: 'Time to First Byte' },
  API_CUSTOMER_ORDER: { target: 600, unit: 'ms', label: 'Customer order tracking API' },
  API_SUPPLIER_ORDERS: { target: 800, unit: 'ms', label: 'Supplier orders API' },
  API_TECHNICIAN_JOBS: { target: 800, unit: 'ms', label: 'Technician jobs API' },
  API_ADMIN_DASHBOARD: { target: 1000, unit: 'ms', label: 'Admin dashboard API' },
} as const;
