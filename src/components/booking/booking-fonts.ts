import { Plus_Jakarta_Sans, Sora } from 'next/font/google';

/**
 * Booking-flow typography.
 *  - Sora: geometric display face for headlines and prices (confident, modern)
 *  - Plus Jakarta Sans: highly legible UI/body face, excellent on small phones
 * Both are self-hosted by next/font: no render-blocking request, no layout shift.
 */
export const bookingDisplay = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-bk-display',
});

export const bookingBody = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-bk-body',
});
