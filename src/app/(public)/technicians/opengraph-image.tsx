import { ImageResponse } from 'next/og';

export const alt = 'Find expert water technicians in Kanpur, Lucknow and Gorakhpur';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#022C22,#065F46)', color: '#fff' }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: '#6EE7B7' }}>AuroTap</div>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>Find Expert Water Technicians</div>
        <div style={{ fontSize: 36, marginTop: 28, color: 'rgba(255,255,255,0.75)' }}>Plumbing · RO · Borewell · Tanker · Tank cleaning</div>
        <div style={{ fontSize: 32, marginTop: 14, color: '#34D399' }}>Kanpur · Lucknow · Gorakhpur</div>
      </div>
    ),
    size,
  );
}
