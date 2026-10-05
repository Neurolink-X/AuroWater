'use client';

import React, { useMemo } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useSettings, buildWhatsappHref } from '@/hooks/useSettings';

export default function WhatsAppFAB() {
  const { settings, whatsappHref } = useSettings();

  const href = useMemo(() => {
    if (!settings.whatsapp_enabled) return null;

    const message =
      'Hi AuroWater, I need help with my booking/service.';

    const baseHref =
      whatsappHref ||
      buildWhatsappHref(settings.phone_primary, message);

    if (!baseHref) return null;

    const separator = baseHref.includes('?') ? '&' : '?';

    return `${baseHref}${separator}text=${encodeURIComponent(message)}`;
  }, [
    settings.whatsapp_enabled,
    settings.phone_primary,
    whatsappHref,
  ]);

  if (!settings.whatsapp_enabled || !href) {
    return null;
  }

  return (
    <div
      className="
        fixed
        bottom-[calc(1rem+env(safe-area-inset-bottom))]
        right-4
        z-[60]
        sm:bottom-6
        sm:right-6
      "
    >
      {/* Desktop / tablet helper label */}
      <div
        className="
          absolute
          right-0
          bottom-[calc(100%+10px)]
          hidden
          whitespace-nowrap
          rounded-xl
          border
          border-slate-200
          bg-white
          px-3
          py-2
          text-xs
          font-semibold
          text-slate-700
          shadow-lg
          sm:block
        "
      >
        Need help?
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with AuroWater support on WhatsApp"
        title="Chat with AuroWater support"
        className="
          group
          relative
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-full
          bg-[#25D366]
          text-white
          shadow-[0_8px_30px_rgba(37,211,102,0.30)]
          ring-1
          ring-white/80
          transition
          duration-200
          hover:-translate-y-0.5
          hover:scale-[1.03]
          hover:shadow-[0_12px_35px_rgba(37,211,102,0.38)]
          active:scale-95
          focus:outline-none
          focus-visible:ring-4
          focus-visible:ring-[#25D366]/30
          sm:h-15
          sm:w-15
        "
      >
        {/* Subtle status indicator */}
        <span
          aria-hidden="true"
          className="
            absolute
            right-0
            top-0
            h-3.5
            w-3.5
            rounded-full
            border-2
            border-white
            bg-emerald-500
          "
        />

        {/* WhatsApp icon */}
        <svg
          width="27"
          height="27"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:scale-105"
        >
          <path d="M20.52 3.48A11.87 11.87 0 0 0 12.05 0C5.49 0 .15 5.34.15 11.9c0 2.1.55 4.15 1.6 5.96L.05 24l6.28-1.65a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.43-8.43ZM12.06 21.84h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.73.98.99-3.64-.24-.37a9.88 9.88 0 0 1-1.52-5.32c0-5.47 4.45-9.92 9.92-9.92 2.65 0 5.14 1.03 7.02 2.91a9.86 9.86 0 0 1 2.9 7.02c0 5.48-4.45 9.93-9.94 9.93Zm5.44-7.43c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
        </svg>

        <span className="sr-only">
          Contact AuroWater support on WhatsApp
        </span>
      </a>
    </div>
  );
}
