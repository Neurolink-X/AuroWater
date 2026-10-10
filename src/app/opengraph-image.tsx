import { ImageResponse } from 'next/og';

export const alt = 'AuroTap – Water Can Delivery and Home Water Services in Kanpur, Lucknow and Gorakhpur';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #071A2B 0%, #0F2A4A 58%, #06B6D4 140%)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="96" height="96" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 8C20 22 12 30 12 40a20 20 0 0 0 40 0c0-10-8-18-20-32z" fill="#22D3EE" />
            <path d="M22 40c1 6 5 9 11 10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 900, marginLeft: 24 }}>AuroTap</div>
        </div>

        <div style={{ display: 'flex', fontSize: 66, fontWeight: 900, lineHeight: 1.1, marginTop: 40 }}>
          Water, delivered to your door.
        </div>

        <div style={{ display: 'flex', fontSize: 32, color: '#67E8F9', marginTop: 32 }}>
          Kanpur  •  Lucknow  •  Gorakhpur
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#CBD5E1', marginTop: 18 }}>
          Water delivery · RO service · Home water systems
        </div>
      </div>
    ),
    { ...size }
  );
}
