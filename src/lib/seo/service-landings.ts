import { pageMeta } from '@/lib/seo';

export type ServiceLanding = {
  slug: string;
  name: string;
  shortName: string;
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  benefits: string[];
  steps: string[];
  faqs: Array<{ q: string; a: string }>;
  icon: string;
};

export const SERVICE_LANDINGS: Record<string, ServiceLanding> = {
  'water-delivery': {
    slug: 'water-delivery',
    name: 'Water Delivery',
    shortName: 'Water delivery',
    title: 'Water Delivery in Kanpur, UP | Book Local Delivery | AuroWater',
    description: 'Book water delivery in Kanpur with AuroWater. Choose water cans or tanker delivery, add your address, check serviceability and confirm a delivery window.',
    eyebrow: 'Doorstep water delivery',
    intro: 'Get water delivered to your home, office, event or other serviceable address without calling multiple suppliers. AuroWater checks your delivery area before confirmation.',
    benefits: ['Serviceability check before confirmation', 'Choose the quantity and delivery window you need', 'Supplier assignment with live order status', 'One place for one-time and recurring water orders'],
    steps: ['Enter your delivery address', 'Select the water service and quantity', 'Review the final price and time window', 'Track the assigned supplier until delivery'],
    faqs: [
      { q: 'Where does AuroWater deliver?', a: 'AuroWater currently operates in selected areas of Kanpur, Gorakhpur and Lucknow. Availability is checked against the delivery address during booking.' },
      { q: 'Can I order water for the same day?', a: 'Same-day options depend on your service area, supplier capacity, stock and the delivery windows shown at booking.' },
      { q: 'Can I schedule recurring deliveries?', a: 'Yes. Water-can subscriptions can create separate delivery orders on the frequency you choose.' },
    ],
    icon: '💧',
  },
  'water-can-delivery': {
    slug: 'water-can-delivery',
    name: '20L Water Can Delivery',
    shortName: '20L water cans',
    title: '20L Water Can Delivery in Kanpur | AuroWater',
    description: 'Order 20L water can delivery in Kanpur with AuroWater. Check availability, choose quantity, schedule a window and track the supplier from booking to delivery.',
    eyebrow: '20L can delivery',
    intro: 'Order the number of 20L water cans you need from a local supplier network. Your order is checked for serviceability and then routed through the AuroWater dispatch workflow.',
    benefits: ['Order one-time or recurring cans', 'Server-validated order pricing', 'Nearby supplier dispatch workflow', 'Delivery status updates after assignment'],
    steps: ['Save or select your address', 'Choose the number of 20L cans', 'Select one-time or recurring delivery', 'Confirm the slot and track the order'],
    faqs: [
      { q: 'How many 20L cans can I order?', a: 'The platform applies an order quantity limit and can guide larger recurring demand toward subscription or bulk options.' },
      { q: 'Can I repeat a water-can order automatically?', a: 'Yes. AuroWater supports recurring water-can subscriptions with separate delivery orders.' },
      { q: 'Is stock guaranteed before checkout?', a: 'The final fulfillment decision depends on serviceability, supplier capacity and available stock. The platform is designed to avoid assigning orders that a supplier cannot fulfill.' },
    ],
    icon: '🫙',
  },
  'water-tanker-delivery': {
    slug: 'water-tanker-delivery',
    name: 'Water Tanker Delivery',
    shortName: 'Water tanker',
    title: 'Water Tanker Delivery in Kanpur | Bulk Water Supply | AuroWater',
    description: 'Book water tanker delivery in Kanpur for homes, sites, offices and events. Availability and final pricing depend on location, tanker capacity and supplier availability.',
    eyebrow: 'Bulk water supply',
    intro: 'For larger water requirements, use AuroWater to coordinate tanker delivery from available local suppliers rather than relying on a single phone contact.',
    benefits: ['Bulk-delivery workflow', 'Service-area validation', 'Supplier availability matching', 'Clear booking details before confirmation'],
    steps: ['Enter the delivery location', 'Choose the tanker service', 'Review availability and final price', 'Confirm and follow the delivery status'],
    faqs: [
      { q: 'What tanker sizes are available?', a: 'Available capacity depends on the supplier network serving your location. The platform can expose the options that are actually available.' },
      { q: 'Can I book a tanker in advance?', a: 'Scheduled delivery is supported where an appropriate delivery window and supplier capacity are available.' },
      { q: 'Why can tanker availability change?', a: 'Vehicles, supplier capacity, traffic, weather and local operating conditions can change availability.' },
    ],
    icon: '🚚',
  },
  plumber: {
    slug: 'plumber',
    name: 'Plumber Services',
    shortName: 'Plumbing',
    title: 'Plumber Service in Kanpur | Book a Plumber | AuroWater',
    description: 'Book plumbing help in Kanpur through AuroWater for common repair, fitting and installation needs. Final scope and availability depend on the job.',
    eyebrow: 'Home plumbing help',
    intro: 'Book a plumbing visit through a single service flow. Describe the issue, choose a suitable window and get the job coordinated through AuroWater.',
    benefits: ['Structured booking details', 'Service-area checks', 'Technician assignment workflow', 'Clear job status after confirmation'],
    steps: ['Choose plumbing service', 'Add your address and job details', 'Review price and slot', 'Follow the assigned professional'],
    faqs: [
      { q: 'What plumbing work can I book?', a: 'The platform can coordinate common plumbing jobs such as fitting, leakage repair and installation. Final scope depends on site conditions.' },
      { q: 'Is the quoted price always final?', a: 'Simple listed services can have a platform price, while actual scope may require inspection or additional materials.' },
      { q: 'Can I request urgent plumbing help?', a: 'Urgent options depend on local technician availability and the service selected.' },
    ],
    icon: '🔧',
  },
  borewell: {
    slug: 'borewell',
    name: 'Borewell Services',
    shortName: 'Borewell',
    title: 'Borewell Service in Kanpur | Repair & Drilling Support | AuroWater',
    description: 'Explore borewell services in Kanpur through AuroWater for repair, drilling coordination and related water-system work, subject to site assessment and availability.',
    eyebrow: 'Water-system services',
    intro: 'Coordinate borewell-related work through AuroWater. Because borewell jobs are site-specific, final scope depends on inspection, equipment and local conditions.',
    benefits: ['Single booking workflow', 'Address and serviceability validation', 'Professional assignment process', 'Job updates after confirmation'],
    steps: ['Select borewell service', 'Describe the requirement and address', 'Choose the available slot', 'Coordinate the assigned professional'],
    faqs: [
      { q: 'Can borewell work be priced completely online?', a: 'Some listed booking fees can be shown online, but drilling or complex repair scope can depend on site inspection.' },
      { q: 'Do you serve all areas of Kanpur?', a: 'Only serviceable areas are accepted. The booking flow checks the address before confirmation.' },
      { q: 'Can I request borewell repair instead of drilling?', a: 'Yes, where the selected service option is available in your area.' },
    ],
    icon: '⛏️',
  },
  'submersible-pump': {
    slug: 'submersible-pump',
    name: 'Submersible Pump Services',
    shortName: 'Submersible pump',
    title: 'Submersible Pump Service in Kanpur | AuroWater',
    description: 'Book submersible pump-related service in Kanpur through AuroWater. Availability depends on area, professional capacity and job requirements.',
    eyebrow: 'Pump installation & support',
    intro: 'Get submersible-pump installation, repair or related support coordinated through one booking flow.',
    benefits: ['Address-aware serviceability', 'Structured job details', 'Professional assignment', 'Status updates throughout the job'],
    steps: ['Select the pump service', 'Describe the issue or installation', 'Confirm address and slot', 'Coordinate with the assigned professional'],
    faqs: [
      { q: 'Can the professional inspect the pump first?', a: 'For jobs where the final scope depends on inspection, the service flow can be used to request an assessment.' },
      { q: 'Are spare parts included?', a: 'Parts and materials depend on the actual job and are not automatically assumed by the platform.' },
      { q: 'Is the service available everywhere?', a: 'Only serviceable locations with an eligible professional are confirmed.' },
    ],
    icon: '⚙️',
  },
  'motor-repair': {
    slug: 'motor-repair',
    name: 'Motor & Pump Repair',
    shortName: 'Motor repair',
    title: 'Motor & Pump Repair in Kanpur | AuroWater',
    description: 'Book motor and pump repair in Kanpur with AuroWater. Final diagnosis, parts and job scope depend on inspection and equipment condition.',
    eyebrow: 'Motor & pump repair',
    intro: 'Use AuroWater to coordinate water-motor and pump repair work without managing supplier or technician calls manually.',
    benefits: ['Serviceability check', 'Job details captured at booking', 'Professional assignment', 'Transparent status tracking'],
    steps: ['Select repair service', 'Describe the problem', 'Confirm address and time', 'Follow the job status'],
    faqs: [
      { q: 'What if the motor needs a part replacement?', a: 'Replacement parts can be recommended after inspection. Final work scope depends on the equipment and required parts.' },
      { q: 'Can I book urgent repair?', a: 'Urgent service depends on the availability of the appropriate professional in your area.' },
      { q: 'Does booking guarantee repair completion?', a: 'A booking creates the service request; completion can depend on inspection, parts, access and site conditions.' },
    ],
    icon: '🛠️',
  },
  'ro-service': {
    slug: 'ro-service',
    name: 'RO Service & Repair',
    shortName: 'RO service',
    title: 'RO Service in Kanpur | RO Repair & Maintenance | AuroWater',
    description: 'Book RO service and repair in Kanpur with AuroWater for maintenance, filter-related work and common purifier service needs.',
    eyebrow: 'RO purifier service',
    intro: 'Book RO maintenance and repair through AuroWater with an address-aware service flow and professional assignment.',
    benefits: ['Easy service selection', 'Address-aware booking', 'Professional assignment', 'Job status updates'],
    steps: ['Choose the RO service', 'Add purifier/job details', 'Select your address and slot', 'Track the assigned professional'],
    faqs: [
      { q: 'Can I request filter replacement?', a: 'Filter-related service can be requested where the selected option is available. The exact parts required depend on the purifier.' },
      { q: 'Do I need to know my RO model?', a: 'Adding the model and issue helps the professional prepare, but the booking can still depend on inspection.' },
      { q: 'Can I schedule recurring RO maintenance?', a: 'Recurring plans can be added as product features where an appropriate service plan is enabled.' },
    ],
    icon: '💧',
  },
  'tank-cleaning': {
    slug: 'tank-cleaning',
    name: 'Water Tank Cleaning',
    shortName: 'Tank cleaning',
    title: 'Water Tank Cleaning in Kanpur | Book Tank Cleaning | AuroWater',
    description: 'Book overhead or underground water tank cleaning in Kanpur with AuroWater. Service scope and availability depend on tank type and local conditions.',
    eyebrow: 'Water tank cleaning',
    intro: 'Schedule water-tank cleaning with a structured booking flow for homes and other eligible properties.',
    benefits: ['Simple service selection', 'Address-aware availability', 'Professional assignment', 'Clear booking status'],
    steps: ['Select tank-cleaning service', 'Add property and tank details', 'Choose address and slot', 'Track the assigned professional'],
    faqs: [
      { q: 'Can both overhead and underground tanks be handled?', a: 'The listed service can cover eligible tank types, subject to local availability and the selected service scope.' },
      { q: 'Is cleaning included in the listed price?', a: 'The price shown applies to the listed service scope. Special conditions or additional work can affect the final scope.' },
      { q: 'Can I schedule tank cleaning later?', a: 'Yes, where a future slot is available in your service area.' },
    ],
    icon: '🧼',
  },
};

export function getServiceLanding(slug: string): ServiceLanding | null {
  return SERVICE_LANDINGS[slug] ?? null;
}

export function bookingHref(slug: string): string {
  const service =
    slug === 'water-tanker-delivery'
      ? 'water_tanker'
      : slug === 'water-delivery' || slug === 'water-can-delivery'
        ? 'water_can'
        : slug;
  return `/book?service=${encodeURIComponent(service)}`;
}

export function buildServiceMetadata(slug: string, city?: string) {
  const data = getServiceLanding(slug);
  if (!data) return null;
  const locationTitle = city ? data.title.replace(/ in Kanpur| Kanpur/g, ` in ${city}`) : data.title;
  const locationDescription = city
    ? data.description.replace(/ in Kanpur/g, ` in ${city}`)
    : data.description;
  const path = city ? `/${city.toLowerCase()}/${slug}` : `/${slug}`;
  return pageMeta(locationTitle, locationDescription, path);
}
