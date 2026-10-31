import type { ReactNode } from 'react';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';
export type FeedbackAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export interface UserFeedbackProps {
  title: string;
  description: string;
  tone?: FeedbackTone;
  details?: string[];
  hint?: string;
  action?: FeedbackAction;
  secondaryAction?: FeedbackAction;
  icon?: ReactNode;
  id?: string;
  compact?: boolean;
}

const TONE_STYLES: Record<FeedbackTone, {
  frame: string;
  heading: string;
  body: string;
  icon: string;
  button: string;
}> = {
  info: {
    frame: 'border-sky-200 bg-sky-50',
    heading: 'text-sky-950',
    body: 'text-sky-900',
    icon: 'bg-sky-100 text-sky-800',
    button: 'bg-sky-800 text-white hover:bg-sky-900',
  },
  success: {
    frame: 'border-emerald-200 bg-emerald-50',
    heading: 'text-emerald-950',
    body: 'text-emerald-900',
    icon: 'bg-emerald-100 text-emerald-800',
    button: 'bg-emerald-800 text-white hover:bg-emerald-900',
  },
  warning: {
    frame: 'border-amber-200 bg-amber-50',
    heading: 'text-amber-950',
    body: 'text-amber-900',
    icon: 'bg-amber-100 text-amber-800',
    button: 'bg-amber-800 text-white hover:bg-amber-900',
  },
  error: {
    frame: 'border-rose-200 bg-rose-50',
    heading: 'text-rose-950',
    body: 'text-rose-900',
    icon: 'bg-rose-100 text-rose-800',
    button: 'bg-rose-800 text-white hover:bg-rose-900',
  },
};

const DEFAULT_ICONS: Record<FeedbackTone, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '×',
};

/**
 * Accessible feedback for customers, suppliers, technicians and admins.
 *
 * A message must explain what happened and what to do next.
 * This component intentionally avoids auto-dismissal: a user may need time
 * to read instructions, especially on a small screen or with assistive tech.
 */
export default function UserFeedback({
  title,
  description,
  tone = 'info',
  details,
  hint,
  action,
  secondaryAction,
  icon,
  id,
  compact = false,
}: UserFeedbackProps) {
  const style = TONE_STYLES[tone];
  const urgent = tone === 'error';
  return (
    <section
      id={id}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={[
        'w-full min-w-0 max-w-full overflow-hidden rounded-2xl border shadow-sm',
        compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5',
        style.frame,
      ].join(' ')}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            'text-base font-bold',
            style.icon,
          ].join(' ')}
        >
          {icon ?? DEFAULT_ICONS[tone]}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={['text-base font-bold leading-snug', style.heading].join(' ')}>
            {title}
          </h3>
          <p className={['mt-1 break-words text-sm leading-relaxed', style.body].join(' ')}>
            {description}
          </p>
          {details && details.length > 0 ? (
            <ol className={['mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed', style.body].join(' ')}>
              {details.map((detail, index) => (
                <li key={index} className="break-words">{detail}</li>
              ))}
            </ol>
          ) : null}
          {hint ? (
            <p className={['mt-3 break-words text-xs leading-relaxed', style.body].join(' ')}>
              {hint}
            </p>
          ) : null}
          {action || secondaryAction ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {action ? (
                <button
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={[
                    'min-h-11 rounded-xl px-4 py-2 text-sm font-semibold',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    style.button,
                  ].join(' ')}
                >
                  {action.label}
                </button>
              ) : null}
              {secondaryAction ? (
                <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  disabled={secondaryAction.disabled}
                  className={[
                    'min-h-11 rounded-xl border border-current/20 bg-white/70 px-4 py-2',
                    'text-sm font-semibold text-slate-900 hover:bg-white',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  ].join(' ')}
                >
                  {secondaryAction.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
