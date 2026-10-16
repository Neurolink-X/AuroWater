import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

const base = pageMeta(
  'About AuroTap | Water Delivery & Home Water Services in UP',
  'AuroTap is a local-first platform for 20L water can delivery, tankers, RO service, plumbing, borewell, pump repair and tank cleaning in Kanpur, Lucknow and Gorakhpur. Clear prices.',
  '/about'
);

export const metadata: Metadata = {
  ...base,
  keywords: [
    'about AuroTap',
    'AuroWater',
    '20 litre water can delivery Kanpur',
    '20 litre water can delivery Lucknow',
    '20 litre water can delivery Gorakhpur',
    'water tanker delivery Uttar Pradesh',
    'RO service and repair',
    'plumber near me Kanpur',
    'plumber near me',
    'borewell and submersible pump repair',
    'water tank cleaning service',
  ],
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
