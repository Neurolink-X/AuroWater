'use client';

import React from 'react';
import { useSettings, buildWhatsappHref } from '@/hooks/useSettings';

export default function WhatsAppFAB() {
  const { settings, whatsappHref } = useSettings();

  if (!settings.whatsapp_enabled) return null;

  const message = 'Hi AuroWater, I need help with a booking.';
  const href = whatsappHref
    ? `${whatsappHref}?text=${encodeURIComponent(message)}`
    : buildWhatsappHref(settings.phone_primary, message) ?? '#';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with AuroWater on WhatsApp"
      title="Chat on WhatsApp"
      className="pulse-ring fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-card hover:brightness-110 transition-all"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white" aria-hidden="true">
        <path d="M20.5 3.5A12 12 0 0 0 3.5 20.5L2 22l1.5-1.5A12 12 0 1 0 20.5 3.5zM12 22a10 10 0 0 1-5.2-1.5L4 22l1.5-2.8A10 10 0 1 1 12 22zm5.5-7.5c-.3-.1-1.6-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.2-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.4.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-1-2.2-.2-.6-.5-.5-.7-.5-.2 0-.4 0-.6 0-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9 0 1.7 1.2 3.3 1.4 3.5.2.2 2.4 3.7 5.8 5.2.8.4 1.4.6 1.9.7.8.2 1.5.2 2.1.1.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.3-.2-.6-.3z" />
      </svg>
    </a>
  );
}
