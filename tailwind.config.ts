import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        /** Display / marketing headlines — optical sizing avoids large-size clipping */
        display: ['Bricolage Grotesque', 'Syne', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        /** @deprecated prefer `display` — kept for older classnames */
        heading: ['Bricolage Grotesque', 'Syne', 'Outfit', 'sans-serif'],
        syne: ['Syne', 'system-ui', 'sans-serif'],
        /** KPI / numeric emphasis in hero (Syne 900) */
        mono: ['Syne', 'system-ui', 'sans-serif'],
        devanagari: ['Noto Sans Devanagari', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        surface: 'var(--surface)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        card: 'var(--card)',
        border: 'var(--border)',
        footerBg: 'var(--footer-bg)',
      },
    },
  },
  plugins: [],
};

export default config;

