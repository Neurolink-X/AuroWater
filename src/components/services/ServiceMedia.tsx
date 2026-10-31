import Image from 'next/image';
import type { CSSProperties } from 'react';

import {
  ILLUSTRATIONS,
  ILLUSTRATION_ALT,
  type ServiceKey,
} from '@/app/(public)/services/services-data';

/**
 * Shared, server-compatible image layout for both the catalogue and service detail pages.
 *
 * The previous detail view constrained a portrait original to w-auto inside a wide
 * panel, producing the tiny floating picture visible in mobile screenshots. The
 * catalogue also requested a fixed 300px candidate even on larger phones.
 *
 * Keep a fixed aspect ratio for CLS, request the actual CSS display width, and
 * use the same subject-aware crop across both routes. Never enlarge by CSS
 * transform or introduce a hydration dependency just to show a photo.
 *
 * Important: our current 399–557px source files still need genuine higher
 * resolution replacements for retina-level sharpness; no loader can invent detail.
 */
type ServiceMediaProps = {
  serviceKey: ServiceKey;
  variant: 'card' | 'detail';
  /** Only the first visible photograph is high-priority. */
  priority?: boolean;
  className?: string;
};

const FOCAL_POINTS: Record<ServiceKey, string> = {
  water_can: '50% 46%',
  water_tanker: '50% 48%',
  ro_service: '50% 32%',
  plumbing: '50% 32%',
  borewell: '50% 42%',
  motor_pump: '50% 40%',
  tank_cleaning: '50% 36%',
};

const DISPLAY_SIZES = {
  card: '(max-width: 640px) calc(100vw - 52px), (max-width: 1024px) 45vw, 31vw',
  detail: '(max-width: 640px) calc(100vw - 40px), (max-width: 1024px) 90vw, 42vw',
} as const;

const FRAME_CLASSES = {
  card: 'sv-card-illustration relative isolate overflow-hidden bg-slate-100',
  detail:
    'relative isolate aspect-[4/3] w-full overflow-hidden bg-slate-800 sm:aspect-[16/11] lg:aspect-[4/3]',
} as const;

export default function ServiceMedia({
  serviceKey,
  variant,
  priority = false,
  className = '',
}: ServiceMediaProps) {
  const isDetail = variant === 'detail';
  const focalPoint = FOCAL_POINTS[serviceKey];
  const imageStyle: CSSProperties = { objectPosition: focalPoint };

  return (
    <div
      className={`${FRAME_CLASSES[variant]} ${className}`.trim()}
      data-service-image={serviceKey}
      data-service-image-variant={variant}
    >
      <Image
        src={ILLUSTRATIONS[serviceKey]}
        alt={ILLUSTRATION_ALT[serviceKey]}
        fill
        sizes={DISPLAY_SIZES[variant]}
        quality={85}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className="block h-full w-full object-cover"
        style={imageStyle}
        draggable={false}
      />
      {isDetail ? (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/20 to-transparent"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
