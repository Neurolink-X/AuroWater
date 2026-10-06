/**
 * AuroTap recurring water subscription scheduling helpers.
 * Pure functions only: safe to use from API routes and cron jobs.
 */

export type SubscriptionFrequency =
  | 'daily'
  | 'alternate'
  | 'weekly'
  | 'biweekly'
  | 'monthly';

export function isSubscriptionFrequency(
  value: unknown
): value is SubscriptionFrequency {
  return [
    'daily',
    'alternate',
    'weekly',
    'biweekly',
    'monthly',
  ].includes(String(value));
}

function parseDateParts(
  iso: string
): [number, number, number] {
  const [year, month, day] =
    iso.split('-').map(Number);

  return [year, month, day];
}

function toIsoDate(
  date: Date
): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function addSubscriptionFrequency(
  isoDate: string,
  frequency: SubscriptionFrequency
): string {
  const [year, month, day] =
    parseDateParts(isoDate);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  switch (frequency) {
    case 'daily':
      date.setUTCDate(
        date.getUTCDate() + 1
      );
      break;

    case 'alternate':
      date.setUTCDate(
        date.getUTCDate() + 2
      );
      break;

    case 'weekly':
      date.setUTCDate(
        date.getUTCDate() + 7
      );
      break;

    case 'biweekly':
      date.setUTCDate(
        date.getUTCDate() + 14
      );
      break;

    case 'monthly': {
      const targetDay =
        date.getUTCDate();

      date.setUTCDate(1);
      date.setUTCMonth(
        date.getUTCMonth() + 1
      );

      const lastDay =
        new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            0
          )
        ).getUTCDate();

      date.setUTCDate(
        Math.min(
          targetDay,
          lastDay
        )
      );

      break;
    }
  }

  return toIsoDate(date);
}

export function addDays(
  isoDate: string,
  days: number
): string {
  const [year, month, day] =
    parseDateParts(isoDate);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return toIsoDate(date);
}

export function todayIST(): string {
  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).format(new Date());
}

export function scheduledAtIST(
  isoDate: string,
  startTime: string
): string {
  const safeTime =
    /^\d{2}:\d{2}(?::\d{2})?$/.test(
      startTime
    )
      ? startTime
      : '09:00:00';

  return new Date(
    `${isoDate}T${safeTime}+05:30`
  ).toISOString();
}

export function parseTimeSlot(
  value: string
): {
  start: string;
  end: string;
} {
  const match =
    value
      .trim()
      .match(
        /^(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/
      );

  return {
    start:
      match?.[1] ??
      '09:00',
    end:
      match?.[2] ??
      '12:00',
  };
}
