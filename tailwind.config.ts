// import type { Config } from 'tailwindcss';

// const config: Config = {
//   content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
//   theme: {
//     extend: {
//       fontFamily: {
//         /** Display / marketing headlines — optical sizing avoids large-size clipping */
//         display: ['Bricolage Grotesque', 'Syne', 'system-ui', 'sans-serif'],
//         body: ['DM Sans', 'system-ui', 'sans-serif'],
//         /** @deprecated prefer `display` — kept for older classnames */
//         heading: ['Bricolage Grotesque', 'Syne', 'Outfit', 'sans-serif'],
//         syne: ['Syne', 'system-ui', 'sans-serif'],
//         /** KPI / numeric emphasis in hero (Syne 900) */
//         mono: ['Syne', 'system-ui', 'sans-serif'],
//         devanagari: ['Noto Sans Devanagari', 'DM Sans', 'system-ui', 'sans-serif'],
//       },
//       colors: {
//         primary: 'var(--primary)',
//         accent: 'var(--accent)',
//         surface: 'var(--surface)',
//         text: 'var(--text)',
//         muted: 'var(--muted)',
//         danger: 'var(--danger)',
//         warning: 'var(--warning)',
//         card: 'var(--card)',
//         border: 'var(--border)',
//         footerBg: 'var(--footer-bg)',
//       },
//     },
//   },
//   plugins: [],
// };

// export default config;




import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * AuroTap — tailwind.config.ts (world-class edition)
 *
 * What's new:
 * ─ Full design token system via CSS vars (light + dark ready)
 * ─ Fluid typography scale (clamp-based, viewport-responsive)
 * ─ Extended spacing scale (18, 22, 26, 30, 88, 100, 120, 160)
 * ─ Premium shadow system (xs → 2xl + coloured glow shadows)
 * ─ Border-radius tokens (card, pill, button, input)
 * ─ Z-index scale (modal, drawer, toast, tooltip, overlay)
 * ─ Animation library (fade, slide, scale, shimmer, pulse-soft)
 * ─ Transition presets (fast / base / slow / bounce)
 * ─ Backdrop blur tokens
 * ─ Gradient utilities (brand, water, shimmer)
 * ─ Custom plugins: text-balance, tap-highlight-none,
 *   safe-area padding, scrollbar-hide, glass morphism
 * ─ Indian Rupee (₹) content utility
 * ─ All original tokens preserved + deprecated heading kept
 */

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './public/**/*.html',
  ],

  /* ── Dark mode via class (add `dark` to <html>) */
  darkMode: 'class',

  theme: {
    /* ─────────────────────────────────────────────
       SCREENS  — mobile-first, Indian device reality
       Most Indian users: 360–390px wide phones
    ───────────────────────────────────────────── */
    screens: {
      xs: '360px',   // Small Android (Redmi, Realme)
      sm: '480px',   // Large Android / phablet
      md: '768px',   // Tablet
      lg: '1024px',  // Small laptop
      xl: '1280px',  // Desktop
      '2xl': '1536px',
    },

    extend: {
      /* ─────────────────────────────────────────
         FONT FAMILIES
      ───────────────────────────────────────── */
      fontFamily: {
        /** Display / marketing headlines */
        display:     ['Bricolage Grotesque', 'Syne', 'system-ui', 'sans-serif'],
        /** Body copy */
        body:        ['Plus Jakarta Sans', 'DM Sans', 'system-ui', 'sans-serif'],
        /** UI elements (buttons, labels, nav) */
        ui:          ['Plus Jakarta Sans', 'DM Sans', 'system-ui', 'sans-serif'],
        /** Code / monospace */
        code:        ['JetBrains Mono', 'Fira Code', 'monospace'],
        /** Hindi / Devanagari content */
        devanagari:  ['Noto Sans Devanagari', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        /** Numeric KPI emphasis (Syne 900) */
        kpi:         ['Syne', 'system-ui', 'sans-serif'],
        /** @deprecated — use display */
        heading:     ['Bricolage Grotesque', 'Syne', 'Outfit', 'sans-serif'],
        /** @deprecated — use kpi */
        mono:        ['Syne', 'system-ui', 'sans-serif'],
        /** @deprecated — use body */
        syne:        ['Syne', 'system-ui', 'sans-serif'],
      },

      /* ─────────────────────────────────────────
         FLUID TYPOGRAPHY  (clamp — viewport-responsive)
         Usage: text-fluid-sm, text-fluid-base, etc.
      ───────────────────────────────────────── */
      fontSize: {
        'fluid-xs':   ['clamp(0.65rem, 1.8vw, 0.75rem)',  { lineHeight: '1.5' }],
        'fluid-sm':   ['clamp(0.78rem, 2.2vw, 0.875rem)', { lineHeight: '1.55' }],
        'fluid-base': ['clamp(0.88rem, 2.6vw, 1rem)',     { lineHeight: '1.6' }],
        'fluid-lg':   ['clamp(1rem, 3vw, 1.125rem)',      { lineHeight: '1.55' }],
        'fluid-xl':   ['clamp(1.1rem, 3.5vw, 1.25rem)',   { lineHeight: '1.4' }],
        'fluid-2xl':  ['clamp(1.25rem, 4vw, 1.5rem)',     { lineHeight: '1.35' }],
        'fluid-3xl':  ['clamp(1.5rem, 5vw, 2rem)',        { lineHeight: '1.25' }],
        'fluid-4xl':  ['clamp(1.75rem, 6vw, 2.5rem)',     { lineHeight: '1.15' }],
        'fluid-5xl':  ['clamp(2rem, 7vw, 3.5rem)',        { lineHeight: '1.1' }],
        'fluid-hero': ['clamp(2.25rem, 9vw, 5rem)',       { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },

      /* ─────────────────────────────────────────
         COLORS  — all via CSS custom properties
         Define in globals.css :root and .dark {}
      ───────────────────────────────────────── */
      colors: {
        /* Core brand */
        primary:   'var(--primary)',
        'primary-light': 'var(--primary-light)',
        'primary-dark':  'var(--primary-dark)',
        accent:    'var(--accent)',
        'accent-light':  'var(--accent-light)',

        /* Surfaces */
        surface:   'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        card:      'var(--card)',
        'card-hover': 'var(--card-hover)',

        /* Typography */
        text:      'var(--text)',
        'text-2':  'var(--text-2)',
        muted:     'var(--muted)',
        subtle:    'var(--subtle)',

        /* Semantic */
        danger:    'var(--danger)',
        'danger-light': 'var(--danger-light)',
        warning:   'var(--warning)',
        'warning-light': 'var(--warning-light)',
        success:   'var(--success)',
        'success-light': 'var(--success-light)',
        info:      'var(--info)',
        'info-light': 'var(--info-light)',

        /* Structural */
        border:    'var(--border)',
        'border-2': 'var(--border-2)',
        footerBg:  'var(--footer-bg)',
        overlay:   'var(--overlay)',

        /* AuroTap brand palette (static — safe to use without CSS vars) */
        water: {
          50:  '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          950: '#082F49',
        },
        navy: {
          50:  '#F0F6FF',
          100: '#E0EDFF',
          200: '#C0DBFF',
          300: '#91BFFF',
          400: '#5A9BFF',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#1E3163',
          950: '#0A1628',
        },
      },

      /* ─────────────────────────────────────────
         SPACING  — fill gaps in Tailwind's scale
      ───────────────────────────────────────── */
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '17':  '4.25rem',
        '18':  '4.5rem',
        '19':  '4.75rem',
        '22':  '5.5rem',
        '25':  '6.25rem',
        '26':  '6.5rem',
        '30':  '7.5rem',
        '34':  '8.5rem',
        '38':  '9.5rem',
        '42':  '10.5rem',
        '46':  '11.5rem',
        '50':  '12.5rem',
        '54':  '13.5rem',
        '58':  '14.5rem',
        '68':  '17rem',
        '72':  '18rem',
        '76':  '19rem',
        '84':  '21rem',
        '88':  '22rem',
        '92':  '23rem',
        '100': '25rem',
        '104': '26rem',
        '112': '28rem',
        '120': '30rem',
        '128': '32rem',
        '160': '40rem',
        /* Safe area (iOS notch / nav bar) */
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
        /* Bottom nav clearance */
        'nav-h':  '5.5rem',
      },

      /* ─────────────────────────────────────────
         BORDER RADIUS  — semantic names
      ───────────────────────────────────────── */
      borderRadius: {
        'xs':     '0.25rem',
        'sm':     '0.375rem',
        'md':     '0.5rem',
        'lg':     '0.75rem',
        'xl':     '1rem',
        '2xl':    '1.25rem',
        '3xl':    '1.5rem',
        '4xl':    '2rem',
        '5xl':    '2.5rem',
        'card':   '1.25rem',   // at-card standard
        'button': '0.875rem',  // cta buttons
        'input':  '0.75rem',   // form inputs
        'badge':  '999px',     // pill / badge
      },

      /* ─────────────────────────────────────────
         BOX SHADOW  — layered shadow system
      ───────────────────────────────────────── */
      boxShadow: {
        'xs':   '0 1px 2px 0 rgba(0,0,0,0.06)',
        'sm':   '0 1px 4px 0 rgba(0,0,0,0.08)',
        'md':   '0 4px 12px -1px rgba(0,0,0,0.08), 0 2px 6px -1px rgba(0,0,0,0.05)',
        'lg':   '0 8px 24px -3px rgba(0,0,0,0.10), 0 4px 10px -2px rgba(0,0,0,0.06)',
        'xl':   '0 16px 40px -5px rgba(0,0,0,0.12), 0 8px 16px -4px rgba(0,0,0,0.07)',
        '2xl':  '0 24px 64px -8px rgba(0,0,0,0.15), 0 12px 24px -6px rgba(0,0,0,0.08)',
        /* Coloured glow shadows for CTA buttons */
        'glow-blue':  '0 4px 20px rgba(14,165,233,0.40)',
        'glow-navy':  '0 4px 20px rgba(37,99,235,0.35)',
        'glow-water': '0 4px 20px rgba(56,189,248,0.45)',
        'glow-red':   '0 4px 16px rgba(239,68,68,0.35)',
        'glow-green': '0 4px 16px rgba(34,197,94,0.35)',
        /* Inner card highlight */
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.12)',
        /* Bottom nav / floating elements */
        'float':      '0 -2px 20px rgba(10,39,68,0.08), 0 4px 24px rgba(10,39,68,0.06)',
        /* Lifted card on hover */
        'lift':       '0 12px 32px rgba(10,39,68,0.12)',
        /* Remove */
        'none': 'none',
      },

      /* ─────────────────────────────────────────
         Z-INDEX  — predictable layering
      ───────────────────────────────────────── */
      zIndex: {
        'base':    '0',
        'raised':  '10',
        'dropdown':'20',
        'sticky':  '30',
        'header':  '40',
        'overlay': '50',
        'drawer':  '60',
        'modal':   '70',
        'toast':   '80',
        'tooltip': '90',
        'top':     '100',
      },

      /* ─────────────────────────────────────────
         ANIMATIONS  — production-quality motion
      ───────────────────────────────────────── */
      keyframes: {
        /* Fade & slide */
        'fade-in':       { from: { opacity: '0' },            to: { opacity: '1' } },
        'fade-out':      { from: { opacity: '1' },            to: { opacity: '0' } },
        'slide-up':      { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-down':    { from: { opacity: '0', transform: 'translateY(-16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-left': { from: { opacity: '0', transform: 'translateX(-20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'slide-in-right':{ from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        /* Scale */
        'scale-in':      { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'scale-out':     { from: { opacity: '1', transform: 'scale(1)' },   to: { opacity: '0', transform: 'scale(0.92)' } },
        /* Loading */
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.55' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        /* Water drop bounce (brand animation) */
        'drop-bounce': {
          '0%, 100%': { transform: 'translateY(0) scale(1)',    opacity: '1' },
          '40%':      { transform: 'translateY(-12px) scale(1.05)', opacity: '0.9' },
          '60%':      { transform: 'translateY(-6px) scale(1.02)',  opacity: '0.95' },
        },
        /* Notification ping */
        'ping-once': {
          '0%':   { transform: 'scale(1)',    opacity: '1' },
          '75%':  { transform: 'scale(2)',    opacity: '0' },
          '100%': { transform: 'scale(2)',    opacity: '0' },
        },
        /* Drawer / modal enter */
        'drawer-up': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        'drawer-down': {
          from: { transform: 'translateY(0)' },
          to:   { transform: 'translateY(100%)' },
        },
        /* Accordion / collapsible */
        'accordion-open': {
          from: { height: '0', opacity: '0' },
          to:   { height: 'var(--radix-accordion-content-height)', opacity: '1' },
        },
        'accordion-close': {
          from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
          to:   { height: '0', opacity: '0' },
        },
        /* Success checkmark */
        'check-in': {
          '0%':   { transform: 'scale(0) rotate(-45deg)', opacity: '0' },
          '70%':  { transform: 'scale(1.15) rotate(5deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)',   opacity: '1' },
        },
      },

      animation: {
        /* Entrances */
        'fade-in':        'fade-in 0.25s ease-out both',
        'fade-out':       'fade-out 0.2s ease-in both',
        'slide-up':       'slide-up 0.32s cubic-bezier(0.16,1,0.3,1) both',
        'slide-down':     'slide-down 0.32s cubic-bezier(0.16,1,0.3,1) both',
        'slide-in-left':  'slide-in-left 0.32s cubic-bezier(0.16,1,0.3,1) both',
        'slide-in-right': 'slide-in-right 0.32s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in':       'scale-in 0.28s cubic-bezier(0.16,1,0.3,1) both',
        /* Loaders */
        'shimmer':        'shimmer 1.6s linear infinite',
        'pulse-soft':     'pulse-soft 2s ease-in-out infinite',
        'spin-slow':      'spin-slow 3s linear infinite',
        /* Brand */
        'drop-bounce':    'drop-bounce 1.6s ease-in-out infinite',
        'ping-once':      'ping-once 0.7s cubic-bezier(0,0,0.2,1) forwards',
        /* Modals / drawers */
        'drawer-up':      'drawer-up 0.35s cubic-bezier(0.32,0.72,0,1) both',
        'drawer-down':    'drawer-down 0.28s ease-in both',
        'accordion-open': 'accordion-open 0.2s ease-out',
        'accordion-close':'accordion-close 0.18s ease-in',
        /* Feedback */
        'check-in':       'check-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
      },

      /* ─────────────────────────────────────────
         TRANSITIONS  — semantic presets
      ───────────────────────────────────────── */
      transitionDuration: {
        '80':  '80ms',
        '120': '120ms',
        '180': '180ms',
        '220': '220ms',
        '350': '350ms',
        '400': '400ms',
        '500': '500ms',
      },
      transitionTimingFunction: {
        'spring':      'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-in':   'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'smooth':      'cubic-bezier(0.4, 0, 0.2, 1)',
        'decelerate':  'cubic-bezier(0, 0, 0.2, 1)',
        'accelerate':  'cubic-bezier(0.4, 0, 1, 1)',
      },

      /* ─────────────────────────────────────────
         BACKDROP BLUR
      ───────────────────────────────────────── */
      backdropBlur: {
        xs:   '2px',
        sm:   '4px',
        md:   '8px',
        lg:   '16px',
        xl:   '24px',
        '2xl':'40px',
      },

      /* ─────────────────────────────────────────
         BACKGROUND GRADIENTS
         Usage: bg-gradient-brand, etc.
      ───────────────────────────────────────── */
      backgroundImage: {
        /* Brand gradients */
        'gradient-brand':   'linear-gradient(135deg, #0A2744 0%, #1155A6 60%, #0EA5E9 100%)',
        'gradient-water':   'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 50%, #0369A1 100%)',
        'gradient-navy':    'linear-gradient(135deg, #082F49 0%, #0A2744 100%)',
        'gradient-hero':    'linear-gradient(160deg, #030F1E 0%, #051C34 55%, #0A3255 100%)',
        /* Shimmer loading skeleton */
        'gradient-shimmer': 'linear-gradient(90deg, #EFF6FF 25%, #DBEAFE 50%, #EFF6FF 75%)',
        /* Glassmorphism overlays */
        'glass-light':      'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
        'glass-dark':       'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        /* CTA button gradient */
        'gradient-cta':     'linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)',
        'gradient-cta-red': 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        /* Dot grid (used as texture in hero) */
        'dot-grid':         'radial-gradient(circle, rgba(14,165,233,0.12) 1px, transparent 1px)',
        /* Radial glow */
        'radial-glow-blue': 'radial-gradient(ellipse at center, rgba(14,165,233,0.18) 0%, transparent 70%)',
        'radial-glow-navy': 'radial-gradient(ellipse at center, rgba(37,99,235,0.15) 0%, transparent 70%)',
      },

      backgroundSize: {
        'shimmer-size': '200% 100%',
        'dot-grid-sm':  '20px 20px',
        'dot-grid-md':  '30px 30px',
        'dot-grid-lg':  '40px 40px',
      },

      /* ─────────────────────────────────────────
         LINE HEIGHT
      ───────────────────────────────────────── */
      lineHeight: {
        'tighter': '1.1',
        'tight':   '1.2',
        'snug':    '1.35',
        'normal':  '1.5',
        'relaxed': '1.65',
        'loose':   '1.8',
      },

      /* ─────────────────────────────────────────
         LETTER SPACING
      ───────────────────────────────────────── */
      letterSpacing: {
        'tightest': '-0.04em',
        'tighter':  '-0.025em',
        'tight':    '-0.015em',
        'normal':    '0em',
        'wide':     '0.04em',
        'wider':    '0.08em',
        'widest':   '0.16em',
        'label':    '0.12em',    // for ALL-CAPS labels
        'tag':      '0.06em',    // for badge/pill text
      },

      /* ─────────────────────────────────────────
         MIN/MAX WIDTHS
      ───────────────────────────────────────── */
      maxWidth: {
        'mobile': '480px',   // standard mobile layout cap
        'tablet': '768px',
        'prose':  '65ch',
        'form':   '400px',
      },
      minHeight: {
        'screen-svh': '100svh', // small viewport height (mobile browsers)
        'touch':      '44px',   // minimum tap target
      },
      height: {
        'screen-svh': '100svh',
        'screen-dvh': '100dvh',
        'touch':      '44px',
        'touch-lg':   '52px',
        'bottom-nav': '64px',
      },
    },
  },

  /* ─────────────────────────────────────────────────────────
     PLUGINS
  ───────────────────────────────────────────────────────── */
  plugins: [
    /* ── 1. Typography utilities */
    plugin(function ({ addUtilities }) {
      addUtilities({
        /* Balanced text for headings (avoids last-line orphan) */
        '.text-balance':  { 'text-wrap': 'balance' },
        '.text-pretty':   { 'text-wrap': 'pretty' },
        /* Truncate with ellipsis */
        '.line-clamp-1':  { display: '-webkit-box', '-webkit-line-clamp': '1', '-webkit-box-orient': 'vertical', overflow: 'hidden' },
        '.line-clamp-2':  { display: '-webkit-box', '-webkit-line-clamp': '2', '-webkit-box-orient': 'vertical', overflow: 'hidden' },
        '.line-clamp-3':  { display: '-webkit-box', '-webkit-line-clamp': '3', '-webkit-box-orient': 'vertical', overflow: 'hidden' },
        /* Prevent text selection on UI elements */
        '.select-none':   { 'user-select': 'none' },
        /* Rupee prefix (Indian currency) */
        '.rupee::before': { content: '"₹"' },
      });
    }),

    /* ── 2. Touch / mobile utilities */
    plugin(function ({ addUtilities }) {
      addUtilities({
        /* Remove tap highlight on iOS / Android */
        '.tap-none':  { '-webkit-tap-highlight-color': 'transparent' },
        /* Touch-action for scroll performance */
        '.touch-pan-y':       { 'touch-action': 'pan-y' },
        '.touch-pan-x':       { 'touch-action': 'pan-x' },
        '.touch-manipulation':{ 'touch-action': 'manipulation' },
        /* Safe area inset padding (iPhone notch / Dynamic Island) */
        '.pb-safe':   { paddingBottom: 'env(safe-area-inset-bottom)' },
        '.pt-safe':   { paddingTop:    'env(safe-area-inset-top)' },
        '.pl-safe':   { paddingLeft:   'env(safe-area-inset-left)' },
        '.pr-safe':   { paddingRight:  'env(safe-area-inset-right)' },
        '.px-safe':   { paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' },
        '.p-safe':    {
          paddingTop:    'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft:   'env(safe-area-inset-left)',
          paddingRight:  'env(safe-area-inset-right)',
        },
      });
    }),

    /* ── 3. Scrollbar utilities */
    plugin(function ({ addUtilities }) {
      addUtilities({
        /* Hide scrollbar cross-browser */
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width':    'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        /* Thin scrollbar */
        '.scrollbar-thin': {
          'scrollbar-width':    'thin',
          'scrollbar-color':    'var(--border) transparent',
        },
        /* Smooth scroll */
        '.scroll-smooth': { 'scroll-behavior': 'smooth' },
        /* Overscroll prevent (prevents page bounce during scroll) */
        '.overscroll-contain': { 'overscroll-behavior': 'contain' },
        '.overscroll-none':    { 'overscroll-behavior': 'none' },
      });
    }),

    /* ── 4. Glassmorphism utilities */
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.glass': {
          background:      'rgba(255,255,255,0.08)',
          backdropFilter:  'blur(16px)',
          '-webkit-backdrop-filter': 'blur(16px)',
          border:          '1px solid rgba(255,255,255,0.14)',
        },
        '.glass-light': {
          background:      'rgba(255,255,255,0.65)',
          backdropFilter:  'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          border:          '1px solid rgba(255,255,255,0.4)',
        },
        '.glass-dark': {
          background:      'rgba(10,23,48,0.72)',
          backdropFilter:  'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          border:          '1px solid rgba(255,255,255,0.08)',
        },
        '.glass-blue': {
          background:      'rgba(14,165,233,0.12)',
          backdropFilter:  'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          border:          '1px solid rgba(14,165,233,0.22)',
        },
      });
    }),

    /* ── 5. Component shorthand utilities */
    plugin(function ({ addUtilities }) {
      addUtilities({
        /* Standard card */
        '.at-card-base': {
          background:   '#ffffff',
          borderRadius: '1.25rem',
          border:       '1px solid rgba(14,165,233,0.10)',
          boxShadow:    '0 2px 12px rgba(10,39,68,0.06)',
          overflow:     'hidden',
        },
        /* Shimmer skeleton loader */
        '.skeleton': {
          background:     'linear-gradient(90deg, #EFF6FF 25%, #DBEAFE 50%, #EFF6FF 75%)',
          backgroundSize: '200% 100%',
          animation:      'shimmer 1.6s linear infinite',
          borderRadius:   '0.75rem',
        },
        /* CTA button base */
        '.btn-primary': {
          background:   'linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)',
          color:        '#ffffff',
          fontWeight:   '800',
          borderRadius: '0.875rem',
          padding:      '0.875rem 1.5rem',
          border:       'none',
          cursor:       'pointer',
          boxShadow:    '0 4px 20px rgba(14,165,233,0.40)',
          transition:   'opacity 0.15s, transform 0.12s',
          fontFamily:   'inherit',
          '&:active':   { opacity: '0.88', transform: 'scale(0.98)' },
          '&:disabled': { opacity: '0.55', cursor: 'not-allowed' },
        },
        /* Input base */
        '.input-base': {
          width:        '100%',
          border:       '1.5px solid var(--border)',
          borderRadius: '0.75rem',
          padding:      '0.75rem 1rem',
          fontSize:     '0.9375rem',
          fontWeight:   '600',
          color:        'var(--text)',
          background:   'var(--surface)',
          outline:      'none',
          fontFamily:   'inherit',
          transition:   'border-color 0.18s, box-shadow 0.18s',
        },
        /* Minimum tap target size (WCAG AA) */
        '.tap-target': {
          minHeight: '44px',
          minWidth:  '44px',
        },
        /* Full viewport height with fallback for mobile browsers */
        '.h-screen-safe': {
          height:    '100dvh',
          minHeight: '100svh',
        },
      });
    }),

    /* ── 6. Gradient text utility */
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.text-gradient-brand': {
          background:              'linear-gradient(135deg, #38BDF8, #2563EB)',
          '-webkit-background-clip': 'text',
          'background-clip':         'text',
          '-webkit-text-fill-color': 'transparent',
          'color':                   'transparent',
        },
        '.text-gradient-water': {
          background:              'linear-gradient(135deg, #7DD3FC, #0EA5E9)',
          '-webkit-background-clip': 'text',
          'background-clip':         'text',
          '-webkit-text-fill-color': 'transparent',
          'color':                   'transparent',
        },
        '.text-gradient-gold': {
          background:              'linear-gradient(135deg, #FCD34D, #F59E0B)',
          '-webkit-background-clip': 'text',
          'background-clip':         'text',
          '-webkit-text-fill-color': 'transparent',
          'color':                   'transparent',
        },
      });
    }),

    /* ── 7. Focus ring utilities (accessibility) */
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.focus-ring': {
          '&:focus-visible': {
            outline:       '2px solid #0EA5E9',
            outlineOffset: '2px',
          },
        },
        '.focus-ring-inset': {
          '&:focus-visible': {
            outline:       '2px solid #0EA5E9',
            outlineOffset: '-2px',
          },
        },
      });
    }),
  ],
};

export default config;