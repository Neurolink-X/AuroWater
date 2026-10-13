import localFont from 'next/font/local';

export const bookingDisplay = localFont({
  src: [
    { path: '../../../public/fonts/sora-600.woff2', weight: '600', style: 'normal' },
    { path: '../../../public/fonts/sora-700.woff2', weight: '700', style: 'normal' },
    { path: '../../../public/fonts/sora-800.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-bk-display',
});

export const bookingBody = localFont({
  src: [
    { path: '../../../public/fonts/plus-jakarta-sans-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/plus-jakarta-sans-500.woff2', weight: '500', style: 'normal' },
    { path: '../../../public/fonts/plus-jakarta-sans-600.woff2', weight: '600', style: 'normal' },
    { path: '../../../public/fonts/plus-jakarta-sans-700.woff2', weight: '700', style: 'normal' },
    { path: '../../../public/fonts/plus-jakarta-sans-800.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-bk-body',
});






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
