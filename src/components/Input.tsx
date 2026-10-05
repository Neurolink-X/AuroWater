'use client';

import {
  InputHTMLAttributes,
  ReactNode,
  useId,
} from 'react';
import { CircleAlert } from 'lucide-react';

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  id,
  required,
  startAdornment,
  endAdornment,
  containerClassName = '',
  className = '',
  ...props
}: InputProps) {
  const generatedId = useId();

  const inputId = id ?? `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy = [
    hint ? hintId : '',
    error ? errorId : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={`mb-4 ${containerClassName}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-slate-700"
        >
          <span>{label}</span>

          {required && (
            <span
              className="text-red-500"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}

      {/* Input */}
      <div className="relative">
        {startAdornment && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
            aria-hidden="true"
          >
            {startAdornment}
          </div>
        )}

        <input
          {...props}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'w-full rounded-xl border bg-white',
            'px-3.5 py-2.5',
            'text-sm text-slate-900',
            'placeholder:text-slate-400',
            'shadow-sm',
            'transition-all duration-150',
            'focus:outline-none',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            'read-only:bg-slate-50',
            startAdornment ? 'pl-10' : '',
            endAdornment ? 'pr-10' : '',
            error
              ? [
                  'border-red-300',
                  'focus:border-red-500',
                  'focus:ring-4 focus:ring-red-500/10',
                ].join(' ')
              : [
                  'border-slate-200',
                  'hover:border-slate-300',
                  'focus:border-emerald-500',
                  'focus:ring-4 focus:ring-emerald-500/10',
                ].join(' '),
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {endAdornment}
          </div>
        )}
      </div>

      {/* Hint */}
      {hint && !error && (
        <p
          id={hintId}
          className="mt-1.5 text-xs leading-4 text-slate-500"
        >
          {hint}
        </p>
      )}

      {/* Error */}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-4 text-red-600"
        >
          <CircleAlert
            size={14}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
