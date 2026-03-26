'use client';

import React from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

export default function SectionWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  useScrollAnimation();

  const items = React.Children.toArray(children);

  return (
    <section className={className}>
      {items.map((child, idx) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          className={`fade-up fade-up-delay-${Math.min(idx + 1, 5)}`}
        >
          {child}
        </div>
      ))}
    </section>
  );
}

