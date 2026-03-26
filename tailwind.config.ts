import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
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

