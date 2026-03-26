import Link from 'next/link';
import React from 'react';
import { MessageCircle } from 'lucide-react';

const InstagramIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M17.5 6.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const FacebookIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v3H7v3h3v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

const social = [
  { Icon: InstagramIcon, href: 'https://instagram.com', label: 'Instagram' },
  { Icon: FacebookIcon, href: 'https://facebook.com', label: 'Facebook' },
];

export default function Footer() {
  return (
    <footer className="bg-[var(--footer-bg)] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💧</span>
              <div className="font-extrabold text-xl">AuroWater</div>
            </div>
            <p className="text-sm text-white/80">
              Reliable water supply and water-system services for India.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <a
                href="https://wa.me/919889305803"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 transition"
                aria-label="WhatsApp"
              >
                <MessageCircle size={18} />
              </a>
              {social.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 transition"
                  aria-label={label}
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="font-bold text-white/95">Quick Links</div>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              <Link href="/" className="hover:text-white transition">Home</Link>
              <Link href="/services" className="hover:text-white transition">Services</Link>
              <Link href="/how-it-works" className="hover:text-white transition">How It Works</Link>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <Link href="/about" className="hover:text-white transition">About</Link>
              <Link href="/contact" className="hover:text-white transition">Contact</Link>
              <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
            </div>
          </div>

          <div className="space-y-3">
            <div className="font-bold text-white/95">Services</div>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              <span>Water Tanker Delivery</span>
              <span>RO Service</span>
              <span>Plumbing</span>
              <span>Borewell</span>
              <span>Motor Repair</span>
              <span>Tank Cleaning</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="font-bold text-white/95">Contact</div>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              <div>📞 +91 9889305803</div>
              <div>✉️ support.aurotap@gmail.com</div>
              <div>📍 India</div>
              <div>🕐 Mon–Sat 6AM–10PM</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-white/80">
          <div>© 2026 AuroWater. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

