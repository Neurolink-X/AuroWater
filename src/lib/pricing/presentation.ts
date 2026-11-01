function flatten(value: unknown, prefix = '', result: Record<string, unknown> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? prefix + '.' + key : key, result);
  } else if (prefix) result[prefix] = value;
  return result;
}
export function pricingChanges(before: unknown, after: unknown) {
  const previous = flatten(before);
  const next = flatten(after);
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])].sort()
    .filter(field => previous[field] !== next[field])
    .map(field => ({ field, before: previous[field] ?? 'Not set / inherits global', after: next[field] ?? 'Not set / inherits global' }));
}
export function pricingValue(field: string, value: unknown): string {
  if (typeof value !== 'number') return String(value);
  if (field.endsWith('gst_rate')) return (value * 100).toLocaleString('en-IN', {maximumFractionDigits:2}) + '%';
  if (field.endsWith('bulk_threshold')) return value + ' cans';
  return '₹' + value.toLocaleString('en-IN', {maximumFractionDigits:2});
}
type PricingCopy = { default_can_price:number; chilled_can_price:number; subscription_can_price:number; convenience_fee:number; delivery_fee:number; gst_rate:number; service_base_prices:Record<string,number> };
export function pricingFaqs(s: PricingCopy) {
  const money = (n:number) => pricingValue('',n);
  return [
    {q:'How much does 20L RO water delivery cost?',a:`Normal RO starts at ${money(s.default_can_price)} and chilled RO at ${money(s.chilled_can_price)} per can. Convenience ${money(s.convenience_fee)}, delivery ${money(s.delivery_fee)} and GST ${pricingValue('gst_rate',s.gst_rate)} are itemised at checkout. City and quantity can change the applicable rate.`},
    {q:'How do monthly water plans work?',a:`Normal RO subscription base rate is ${money(s.subscription_can_price)} per can. Each delivery is paid separately with its agreed fees. Existing plans keep their saved pricing contract; new plans use current published pricing.`},
    {q:'How much does water tank cleaning cost?',a:`The current base rate is ${money(s.service_base_prices.tank_cleaning)}. Tank size, scope, fees and taxes are shown or quoted before confirmation.`},
    {q:'What is the plumber visit charge?',a:`The current plumbing labour base rate is ${money(s.service_base_prices.plumbing)}. Additional work and materials require an agreed quote. Review fees and taxes before confirming.`},
  ];
}

export function pricingLabel(field: string) {
  const words = (value:string) => value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
  const parts = field.split('.');
  if (parts[0] === 'city_overrides') return words(parts[1]) + ' → ' + parts.slice(2).filter(p=>p!=='services').map(words).join(' / ');
  return parts.filter(p=>p!=='services').map(words).join(' / ');
}
export function pricingEntries(config: unknown) {
  return Object.entries(flatten(config)).map(([field,value])=>({field,value}));
}
