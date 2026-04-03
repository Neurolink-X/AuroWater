// 'use client';

// import { ReactNode } from 'react';

// interface ButtonProps {
//   children: ReactNode;
//   onClick?: () => void;
//   type?: 'button' | 'submit' | 'reset';
//   variant?: 'primary' | 'secondary' | 'danger';
//   disabled?: boolean;
//   isLoading?: boolean;
//   className?: string;
// }

// export function Button({
//   children,
//   onClick,
//   type = 'button',
//   variant = 'primary',
//   disabled = false,
//   isLoading = false,
//   className = '',
// }: ButtonProps) {
//   const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

//   const variants = {
//     primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
//     secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400',
//     danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
//   };

//   return (
//     <button
//       type={type}
//       onClick={onClick}
//       disabled={disabled || isLoading}
//       className={`${baseStyles} ${variants[variant]} ${className}`}
//     >
//       {isLoading ? 'Loading...' : children}
//     </button>
//   );
// }
'use client';

import { ReactNode } from 'react';

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success' | 'dark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

/* ─────────────────────────────────────────────
   SPINNER
───────────────────────────────────────────── */
function Spinner({ size }: { size: string }) {
  const dim = size === 'xs' || size === 'sm' ? 12 : size === 'lg' || size === 'xl' ? 18 : 15;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: 'btn-spin 0.7s linear infinite', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   STYLE MAPS
───────────────────────────────────────────── */
const SIZE_STYLES: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
};

const VARIANT_STYLES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  danger:    'btn-danger',
  ghost:     'btn-ghost',
  outline:   'btn-outline',
  success:   'btn-success',
  dark:      'btn-dark',
};

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  'aria-label': ariaLabel,
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&display=swap');

        @keyframes btn-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes btn-ripple {
          0%   { transform: scale(0); opacity: 0.35; }
          100% { transform: scale(4); opacity: 0; }
        }

        .btn-base {
          font-family: 'DM Sans', sans-serif;
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 7px; border: none; cursor: pointer;
          font-weight: 650; letter-spacing: -0.1px;
          transition:
            background 0.18s ease,
            box-shadow 0.18s ease,
            transform  0.14s ease,
            opacity    0.18s ease,
            border-color 0.18s ease;
          white-space: nowrap; text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          vertical-align: middle;
        }
        .btn-base:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.35);
        }
        .btn-base:not(:disabled):active {
          transform: scale(0.97);
        }
        .btn-base:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        /* ── Ripple ── */
        .btn-ripple-circle {
          position: absolute; border-radius: 50%;
          width: 60px; height: 60px;
          margin-top: -30px; margin-left: -30px;
          background: rgba(255,255,255,0.35);
          pointer-events: none;
          animation: btn-ripple 0.55s linear;
        }

        /* ── Sizes ── */
        .btn-xs  { padding: 5px 11px;  border-radius: 8px;  font-size: 11.5px; gap: 5px; }
        .btn-sm  { padding: 7px 14px;  border-radius: 9px;  font-size: 12.5px; gap: 6px; }
        .btn-md  { padding: 10px 18px; border-radius: 11px; font-size: 13.5px; gap: 7px; }
        .btn-lg  { padding: 13px 24px; border-radius: 13px; font-size: 15px;   gap: 8px; }
        .btn-xl  { padding: 16px 32px; border-radius: 15px; font-size: 16px;   gap: 9px; }

        /* ── Full width ── */
        .btn-full { width: 100%; }

        /* ── PRIMARY ── */
        .btn-primary {
          background: #2563EB;
          color: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 3px 10px rgba(37,99,235,0.28);
        }
        .btn-primary:not(:disabled):hover {
          background: #1D4ED8;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08), 0 6px 18px rgba(37,99,235,0.38);
          transform: translateY(-1px);
        }

        /* ── SECONDARY ── */
        .btn-secondary {
          background: #F1F5F9;
          color: #334155;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .btn-secondary:not(:disabled):hover {
          background: #E2E8F0;
          color: #1E293B;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }

        /* ── DANGER ── */
        .btn-danger {
          background: #DC2626;
          color: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 3px 10px rgba(220,38,38,0.28);
        }
        .btn-danger:not(:disabled):hover {
          background: #B91C1C;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08), 0 6px 18px rgba(220,38,38,0.35);
          transform: translateY(-1px);
        }

        /* ── GHOST ── */
        .btn-ghost {
          background: transparent;
          color: #475569;
          box-shadow: none;
        }
        .btn-ghost:not(:disabled):hover {
          background: #F1F5F9;
          color: #1E293B;
        }

        /* ── OUTLINE ── */
        .btn-outline {
          background: transparent;
          color: #2563EB;
          border: 1.5px solid #BFDBFE !important;
          box-shadow: none;
        }
        .btn-outline:not(:disabled):hover {
          background: #EFF6FF;
          border-color: #93C5FD !important;
          box-shadow: 0 3px 10px rgba(37,99,235,0.12);
          transform: translateY(-1px);
        }

        /* ── SUCCESS ── */
        .btn-success {
          background: #059669;
          color: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 3px 10px rgba(5,150,105,0.28);
        }
        .btn-success:not(:disabled):hover {
          background: #047857;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08), 0 6px 18px rgba(5,150,105,0.35);
          transform: translateY(-1px);
        }

        /* ── DARK ── */
        .btn-dark {
          background: #0F172A;
          color: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15), 0 3px 10px rgba(15,23,42,0.25);
        }
        .btn-dark:not(:disabled):hover {
          background: #1E293B;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15), 0 6px 18px rgba(15,23,42,0.3);
          transform: translateY(-1px);
        }

        /* ── Icon sizing ── */
        .btn-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
        .btn-loading-text { opacity: 0.85; }
      `}</style>

      <button
        type={type}
        onClick={(e) => {
          if (isDisabled) return;
          /* ripple effect */
          const btn = e.currentTarget;
          const circle = document.createElement('span');
          const rect = btn.getBoundingClientRect();
          circle.className = 'btn-ripple-circle';
          circle.style.left = `${e.clientX - rect.left}px`;
          circle.style.top  = `${e.clientY - rect.top}px`;
          btn.appendChild(circle);
          setTimeout(() => circle.remove(), 560);
          onClick?.();
        }}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        className={[
          'btn-base',
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          fullWidth ? 'btn-full' : '',
          className,
        ].filter(Boolean).join(' ')}
      >
        {isLoading ? (
          <>
            <Spinner size={size} />
            {loadingText && <span className="btn-loading-text">{loadingText}</span>}
          </>
        ) : (
          <>
            {leftIcon  && <span className="btn-icon">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="btn-icon">{rightIcon}</span>}
          </>
        )}
      </button>
    </>
  );
}