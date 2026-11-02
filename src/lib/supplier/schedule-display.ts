/** Display booking dates in India Standard Time without moving a local date-only value. */
export function formatSupplierSchedule(
  dateValue: unknown,
  slotValue: unknown,
  language: 'en' | 'hi' = 'en',
): string {
  const dateRaw = typeof dateValue === 'string' ? dateValue.trim() : '';
  const slotRaw = typeof slotValue === 'string' ? slotValue.trim() : '';
  let dateLabel = language === 'hi' ? 'तारीख की पुष्टि बाकी' : 'Date to be confirmed';
  let timeFromDate = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const d = new Date(dateRaw + 'T12:00:00+05:30');
    if (Number.isFinite(d.getTime())) dateLabel = new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    }).format(d);
  } else if (dateRaw) {
    const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateRaw) ? dateRaw :
      /^\d{4}-\d{2}-\d{2}[T ]/.test(dateRaw) ? dateRaw.replace(' ', 'T') + '+05:30' : dateRaw;
    const date = new Date(normalized);
    if (Number.isFinite(date.getTime())) {
      dateLabel = new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
      }).format(date);
      timeFromDate = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
      }).format(date);
    }
  }
  let slot = slotRaw;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(slotRaw)) {
    const date = new Date(slotRaw);
    slot = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(date) : '';
  }
  const time = slot || timeFromDate;
  return time ? `${dateLabel} · ${time} IST` : `${dateLabel} · ${language === 'hi' ? 'समय पुष्टि बाकी' : 'Slot not confirmed'} (IST)`;
}
