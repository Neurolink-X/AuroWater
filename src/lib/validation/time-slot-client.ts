/**
 * Client-side time slot validation.
 * Rules: required, end > start, min 30 minutes, future only.
 */

const MIN_SLOT_MINUTES = 30;
const TIME_REG = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

export interface TimeSlotValue {
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
  date: string;       // "YYYY-MM-DD"
  time_slot: string;  // "HH:mm - HH:mm"
  scheduled_time: string; // ISO
  valid: boolean;
  errors: string[];
}

function parseMinutes(t: string): number | null {
  const m = t.trim().match(TIME_REG);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function validateTimeSlotClient(
  startTime: string,
  endTime: string,
  date: string
): { valid: boolean; errors: string[]; time_slot: string; scheduled_time: string } {
  const errors: string[] = [];

  if (!startTime?.trim()) errors.push('Start time is required');
  if (!endTime?.trim()) errors.push('End time is required');
  if (!date?.trim()) errors.push('Date is required');

  const startM = startTime ? parseMinutes(startTime) : null;
  const endM = endTime ? parseMinutes(endTime) : null;

  if (startTime && startM === null) errors.push('Invalid start time (use HH:mm)');
  if (endTime && endM === null) errors.push('Invalid end time (use HH:mm)');

  if (startM !== null && endM !== null) {
    if (endM <= startM) errors.push('End time must be after start time');
    else if (endM - startM < MIN_SLOT_MINUTES) errors.push('Minimum slot duration is 30 minutes');
  }

  let scheduled_time = '';
  let time_slot = '';

  if (date && startM !== null && endM !== null) {
    const [y, m, d] = date.split('-').map(Number);
    const slotStart = new Date(y, m - 1, d, Math.floor(startM / 60), startM % 60, 0, 0);
    const now = new Date();
    if (slotStart.getTime() < now.getTime()) {
      errors.push('Time slot must be in the future');
    }
    scheduled_time = slotStart.toISOString();
    time_slot = `${formatTime(startM)} - ${formatTime(endM)}`;
  }

  return {
    valid: errors.length === 0,
    errors,
    time_slot,
    scheduled_time,
  };
}

/** Generate time options every 30 minutes */
export function getTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}

/** Min date for picker (today) */
export function getMinDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
