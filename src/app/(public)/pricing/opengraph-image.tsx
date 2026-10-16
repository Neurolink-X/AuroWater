import { ImageResponse } from 'next/og';
import { CHILLED_RO_PRICE, NORMAL_RO_PRICE } from './pricing-shared';

export const alt = 'Water can delivery prices in Kanpur, Lucknow and Gorakhpur';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Satori (next/og) rules: every <div> with more than one child needs display:flex,
// and the default font has no rupee glyph, so we write "Rs." and build each line as ONE string.
export default function Image() {
  const headline = `20L cans from Rs. ${NORMAL_RO_PRICE}`;
  const sub = `Chilled RO Rs. ${CHILLED_RO_PRICE} · Delivery included`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(135deg,#022C22,#065F46 60%,#0D9B6C)',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: '#6EE7B7' }}>AuroWater</div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>{headline}</div>
        <div style={{ display: 'flex', fontSize: 38, marginTop: 24, color: '#D1FAE5' }}>{sub}</div>
        <div style={{ display: 'flex', fontSize: 32, marginTop: 14, color: '#34D399' }}>Kanpur · Lucknow · Gorakhpur</div>
      </div>
    ),
    size,
  );
}
