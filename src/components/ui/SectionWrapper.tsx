// src/components/ui/SectionWrapper.tsx
'use client';

import React, { useMemo } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

type SectionWrapperProps = {
  children: React.ReactNode;
  className?: string;
  /** Optional: lets you use the wrapper as a different HTML tag. */
  as?: 'section' | 'div' | 'article' | 'main';
  /** Optional: anchor link, for example id="pricing". */
  id?: string;
  /** Optional: label for screen readers. */
  ariaLabel?: string;
};

/** The same 5 delay steps your CSS already has: fade-up-delay-1 to 5. */
const MAX_DELAY_STEP = 5;

export default function SectionWrapper({
  children,
  className,
  as = 'section',
  id,
  ariaLabel,
}: SectionWrapperProps) {
  useScrollAnimation();

  const Tag = as;

  // Only rebuilt when children change.
  const items = useMemo(() => React.Children.toArray(children), [children]);

  return (
    <Tag id={id} aria-label={ariaLabel} className={className}>
      {items.map((child, idx) => (
        <div
          // toArray gives every element a stable key. Index is only
          // the backup for plain text or numbers.
          key={
            React.isValidElement(child) && child.key != null ? child.key : idx
          }
          className={`fade-up fade-up-delay-${Math.min(idx + 1, MAX_DELAY_STEP)}`}
        >
          {child}
        </div>
      ))}
    </Tag>
  );
}
