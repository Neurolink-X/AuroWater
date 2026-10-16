import { ImageResponse } from 'next/og';
import { CHILLED_RO_PRICE, NORMAL_RO_PRICE } from './pricing-shared';

export const alt = 'Water can delivery prices in Kanpur, Lucknow and Gorakhpur';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#022C22,#065F46 60%,#0D9B6C)', color: '#fff' }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: '#6EE7B7' }}>AuroWater</div>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>20L cans from ₹{NORMAL_RO_PRICE}</div>
        <div style={{ fontSize: 38, marginTop: 24, color: 'rgba(255,255,255,0.8)' }}>Chilled RO ₹{CHILLED_RO_PRICE} · Delivery included</div>
        <div style={{ fontSize: 32, marginTop: 14, color: '#34D399' }}>Kanpur · Lucknow · Gorakhpur</div>
      </div>
    ),
    size,
  );
}
