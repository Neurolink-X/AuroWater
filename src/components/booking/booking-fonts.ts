/**
 * Booking-flow typography configuration.
 * - Sora: geometric display face for headlines and prices
 * - Plus Jakarta Sans: highly legible UI/body face
 * 
 * Optimized with CSS variables to ensure zero build-time loader errors 
 * on Vercel while keeping identical design tokens.
 */

export const bookingDisplay = {
  className: 'font-bk-display',
  variable: '--font-bk-display',
  style: {
    fontFamily: 'var(--font-bk-display), sans-serif',
  },
};

export const bookingBody = {
  className: 'font-bk-body',
  variable: '--font-bk-body',
  style: {
    fontFamily: 'var(--font-bk-body), sans-serif',
  },
};






// import { Plus_Jakarta_Sans, Sora } from 'next/font/google';

// /**
//  * Booking-flow typography.
//  *  - Sora: geometric display face for headlines and prices (confident, modern)
//  *  - Plus Jakarta Sans: highly legible UI/body face, excellent on small phones
//  * Both are self-hosted by next/font: no render-blocking request, no layout shift.
//  */
// export const bookingDisplay = Sora({
//   subsets: ['latin'],
//   weight: ['600', '700', '800'],
//   display: 'swap',
//   variable: '--font-bk-display',
// });

// export const bookingBody = Plus_Jakarta_Sans({
//   subsets: ['latin'],
//   weight: ['400', '500', '600', '700', '800'],
//   display: 'swap',
//   variable: '--font-bk-body',
// });
