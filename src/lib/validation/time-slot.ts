/**
 * Server-side time slot validation.
 * Rules: required, end > start, min 30 minutes, future only.
 */

const MIN_SLOT_MINUTES = 30;
const TIME_REG = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

export interface TimeSlotInput {
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
  date?: string;      // "YYYY-MM-DD" optional; if missing, use "today" for future check
}

export interface TimeSlotResult {
  valid: boolean;
  time_slot: string;       // "HH:mm - HH:mm"
  scheduled_time: string;  // ISO datetime for start of slot
  errors: string[];
}

function parseTime(t: string): number | null {
  const m = t.trim().match(TIME_REG);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Validate time slot and optionally a date for "future only".
 * Returns normalized time_slot string and scheduled_time (ISO) for the slot start on the given date.
 */
export function validateTimeSlot(input: {
  start_time?: string | null;
  end_time?: string | null;
  date?: string | null;
  time_slot?: string | null;  // legacy: "HH:mm - HH:mm"
  scheduled_time?: string | null;
}): TimeSlotResult {
  const errors: string[] = [];
  let start_time = input.start_time;
  let end_time = input.end_time;
  let date = input.date;

  // Support legacy time_slot "HH:mm - HH:mm"
  if ((!start_time || !end_time) && input.time_slot) {
    const parts = String(input.time_slot).split(/\s*-\s*/).map((s) => s.trim());
    if (parts.length >= 2) {
      start_time = start_time || parts[0];
      end_time = end_time || parts[1];
    }
  }

  if (!start_time) errors.push('Start time is required');
  if (!end_time) errors.push('End time is required');

  const startM = start_time ? parseTime(start_time) : null;
  const endM = end_time ? parseTime(end_time) : null;

  if (start_time && startM === null) errors.push('Invalid start time format (use HH:mm)');
  if (end_time && endM === null) errors.push('Invalid end time format (use HH:mm)');

  if (startM !== null && endM !== null) {
    if (endM <= startM) errors.push('End time must be after start time');
    else {
      const durationMin = endM - startM;
      if (durationMin < MIN_SLOT_MINUTES) errors.push(`Minimum slot duration is ${MIN_SLOT_MINUTES} minutes`);
    }
  }

  // Date / future only
  let scheduledDate: Date;
  if (input.scheduled_time) {
    scheduledDate = new Date(input.scheduled_time);
    if (Number.isNaN(scheduledDate.getTime())) errors.push('Invalid scheduled_time');
  } else if (date && start_time && startM !== null) {
    const [y, m, d] = date.split('-').map(Number);
    scheduledDate = new Date(y, m - 1, d, Math.floor(startM / 60), startM % 60, 0, 0);
  } else {
    scheduledDate = new Date();
    if (startM !== null) {
      scheduledDate.setHours(Math.floor(startM / 60), startM % 60, 0, 0);
    }
  }

  const now = new Date();
  if (scheduledDate.getTime() < now.getTime()) {
    errors.push('Time slot must be in the future');
  }

  const time_slot =
    startM !== null && endM !== null
      ? `${formatTime(startM)} - ${formatTime(endM)}`
      : (input.time_slot || '');

  const scheduled_time =
    !Number.isNaN(scheduledDate.getTime()) ? scheduledDate.toISOString() : '';

  return {
    valid: errors.length === 0,
    time_slot,
    scheduled_time,
    errors,
  };
}
