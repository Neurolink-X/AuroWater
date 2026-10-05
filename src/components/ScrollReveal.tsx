// src/components/ScrollReveal.tsx
'use client';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

export default function ScrollReveal() {
  useScrollAnimation();
  return null;
}

// src/app/layout.tsx → <body><ScrollReveal />{children}</body>
