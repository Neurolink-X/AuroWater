'use client';

import React from 'react';

const whatsAppHref = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP;
  const num = typeof fromEnv === 'string' && fromEnv.trim().length ? fromEnv.trim() : '919889305803';
  return `https://wa.me/${num}`;
})();

export default function WhatsAppFAB() {
  return (
    <a
      href={whatsAppHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="pulse-ring fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0D9B6C] text-white shadow-card hover:bg-[#086D4C] transition-colors"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20 11.5C20 15.64 16.42 19 12.2 19C10.7 19 9.3 18.61 8.1 17.9L4 19L5.1 15.2C4.45 14 4.1 12.7 4.1 11.5C4.1 7.36 7.68 4 11.9 4C16.12 4 20 7.36 20 11.5Z"
          stroke="white"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M9.2 9.4C9.4 9.1 9.7 9 10 9C10.3 9 10.6 9.1 10.7 9.4L11.3 10.7C11.4 10.9 11.4 11.1 11.3 11.3L11 11.7C10.9 11.8 10.9 12 11 12.2C11.3 12.8 11.8 13.4 12.4 13.7C12.6 13.8 12.8 13.8 12.9 13.7L13.3 13.4C13.5 13.3 13.7 13.3 13.9 13.4L15.2 14C15.5 14.1 15.6 14.4 15.6 14.7C15.6 15 15.5 15.3 15.2 15.5C15 15.7 14.7 15.9 14.4 16C14 16.1 13.6 16.1 13.2 16C10.8 15.2 9 13.4 8.2 11C8.1 10.6 8.1 10.2 8.2 9.8C8.3 9.5 8.5 9.2 9.2 9.4Z"
          fill="white"
          opacity="0.95"
        />
      </svg>
    </a>
  );
}

