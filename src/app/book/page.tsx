import BookingWizard from '@/components/booking/BookingWizard';

/** Booking shell — metadata lives in `layout.tsx` so `/book` stays client-only wizard without duplicating titles. */
export default function BookPage() {
  return <BookingWizard />;
}
