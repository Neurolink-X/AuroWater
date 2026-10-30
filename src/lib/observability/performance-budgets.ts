export const WEB_VITALS_BUDGETS = {
  LCP: { target: 2500, unit: 'ms', label: 'Largest Contentful Paint' },
  INP: { target: 200, unit: 'ms', label: 'Interaction to Next Paint' },
  CLS: { target: 0.1, unit: 'score', label: 'Cumulative Layout Shift' },
  FCP: { target: 1800, unit: 'ms', label: 'First Contentful Paint' },
  TTFB: { target: 800, unit: 'ms', label: 'Time to First Byte' },
} as const;
