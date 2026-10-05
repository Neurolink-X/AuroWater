'use client';

import { ReactNode } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react';

interface AlertProps {
  children: ReactNode;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
  title?: string;
  className?: string;
}

const CONFIG = {
  success: {
    icon: CheckCircle2,
    title: 'Success',
    wrapper:
      'border-emerald-200 bg-emerald-50 text-emerald-900',
    iconColor: 'text-emerald-600',
    close:
      'text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-500',
  },
  error: {
    icon: CircleAlert,
    title: 'Something went wrong',
    wrapper:
      'border-red-200 bg-red-50 text-red-900',
    iconColor: 'text-red-600',
    close:
      'text-red-700 hover:bg-red-100 focus-visible:ring-red-500',
  },
  warning: {
    icon: TriangleAlert,
    title: 'Please check',
    wrapper:
      'border-amber-200 bg-amber-50 text-amber-900',
    iconColor: 'text-amber-600',
    close:
      'text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-500',
  },
  info: {
    icon: Info,
    title: 'Information',
    wrapper:
      'border-blue-200 bg-blue-50 text-blue-900',
    iconColor: 'text-blue-600',
    close:
      'text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-500',
  },
} as const;

export function Alert({
  children,
  type = 'info',
  onClose,
  title,
  className = '',
}: AlertProps) {
  const config = CONFIG[type];
  const Icon = config.icon;

  const isError = type === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={[
        'relative flex w-full items-start gap-3',
        'rounded-xl border px-4 py-3.5',
        'shadow-sm',
        'transition-all duration-200',
        config.wrapper,
        className,
      ].join(' ')}
    >
      {/* Icon */}
      <div
        className={[
          'mt-0.5 shrink-0',
          config.iconColor,
        ].join(' ')}
        aria-hidden="true"
      >
        <Icon size={20} strokeWidth={2.2} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {title && (
          <div className="mb-0.5 text-sm font-bold">
            {title}
          </div>
        )}

        <div className="text-sm leading-5 font-medium">
          {children}
        </div>
      </div>

      {/* Close */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className={[
            'shrink-0 rounded-lg p-1.5',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            config.close,
          ].join(' ')}
        >
          <X size={17} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
