import { ImageResponse } from 'next/og';

import { SERVICE_DETAILS } from '../service-details';
import { BRAND, CITY_LINE } from '../services-data';

/* The picture people see when this page is shared on WhatsApp, Facebook, LinkedIn or X.
   In India most links travel on WhatsApp, so a clear preview lifts clicks.
   No emoji and no custom fonts on purpose: nothing is downloaded while building. */

export const alt = `${BRAND} services in ${CITY_LINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = (SERVICE_DETAILS as Record<string, (typeof SERVICE_DETAILS)[keyof typeof SERVICE_DETAILS] | undefined>)[slug];

  const title = service?.title ?? 'Water delivery & home services';
  const eyebrow = service?.eyebrow ?? 'Water and home services';
  const accent = service?.accent ?? '#0284c7';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(150deg, #0A1628 0%, #0F2557 55%, #1A3A8F 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: accent, display: 'flex' }} />
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, display: 'flex' }}>{BRAND}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 30, color: '#7dd3fc', fontWeight: 700, display: 'flex' }}>{eyebrow}</div>
          <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.05, letterSpacing: -3, marginTop: 14, display: 'flex' }}>{title}</div>
          <div style={{ fontSize: 38, color: '#cbd5e1', marginTop: 22, display: 'flex' }}>{`in ${CITY_LINE}`}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', padding: '14px 28px', borderRadius: 16, background: accent, fontSize: 30, fontWeight: 800 }}>Book online</div>
          <div style={{ display: 'flex', fontSize: 28, color: '#cbd5e1' }}>Address checked · Price confirmed before work</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
